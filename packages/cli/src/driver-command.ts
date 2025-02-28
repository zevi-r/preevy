import { Command, Flags, Interfaces } from '@oclif/core'
import { MachineConnection, MachineDriver, isPartialMachine, profileStore } from '@preevy/core'
import { pickBy } from 'lodash'
import { DriverFlags, DriverName, FlagType, flagsForAllDrivers, machineDrivers, removeDriverPrefix } from './drivers'
import ProfileCommand from './profile-command'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof DriverCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class DriverCommand<T extends typeof Command> extends ProfileCommand<T> {
  static baseFlags = {
    ...ProfileCommand.baseFlags,
    driver: Flags.custom<DriverName>({
      description: 'Machine driver to use',
      char: 'd',
      options: Object.keys(machineDrivers),
      required: false,
    })(),
    ...flagsForAllDrivers,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    this.#driverName = this.flags.driver ?? this.preevyConfig?.driver as DriverName ?? this.profile.driver as DriverName
  }

  #driverName: DriverName | undefined
  get driverName() : DriverName {
    if (!this.#driverName) {
      throw new Error("Driver wasn't specified")
    }
    return this.#driverName
  }

  protected async driverFlags<Name extends DriverName, Type extends FlagType>(
    driver: Name,
    type: Type
  ): Promise<DriverFlags<DriverName, Type>> {
    const driverFlagNames = Object.keys(machineDrivers[driver][type])
    const flagDefaults = pickBy(
      {
        ...await profileStore(this.store).defaultFlags(driver),
        ...this.preevyConfig?.drivers?.[driver] ?? {},
      },
      (_v, k) => driverFlagNames.includes(k),
    ) as DriverFlags<DriverName, Type>
    return {
      ...flagDefaults,
      ...removeDriverPrefix<DriverFlags<DriverName, Type>>(driver, this.flags),
    }
  }

  #driver: MachineDriver | undefined
  async driver(): Promise<MachineDriver> {
    if (this.#driver) {
      return this.#driver
    }
    const { profile, driverName } = this
    this.#driver = machineDrivers[driverName].factory({
      flags: await this.driverFlags(driverName, 'flags') as never,
      profile,
      store: this.store,
      log: this.logger,
      debug: this.flags.debug,
    })
    return this.#driver as MachineDriver
  }

  async withConnection<RT>(
    envId: string,
    f: (connection: MachineConnection) => Promise<RT>,
  ) {
    const connection = await this.connect(envId)
    try {
      return await f(connection)
    } finally {
      connection[Symbol.dispose]()
    }
  }

  async connect(envId: string) {
    const driver = await this.driver()
    const machine = await driver.getMachine({ envId })
    if (!machine || isPartialMachine(machine)) {
      throw new Error(`No machine found for envId ${envId}`)
    }
    // eslint false positive here on case-sensitive filesystems due to unknown type
    // eslint-disable-next-line @typescript-eslint/return-await
    return await driver.connect(machine, { log: this.logger, debug: this.flags.debug })
  }
}

export default DriverCommand
