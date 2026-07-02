/**
 * Migrate config from ~/.omp to ~/.agent.
 */
import { Command, Flags } from "@awfixerai/utils/cli";
import { runMigrateConfig } from "../cli/commands/migrate-config";

export default class MigrateConfig extends Command {
	static description = "Migrate config from ~/.omp to ~/.agent";

	static flags = {
		copy: Flags.boolean({ description: "Copy files instead of symlinking" }),
	};

	static examples = [
		`# Migrate with symlink (default)\n  agent migrate-config`,
		`# Migrate by copying\n  agent migrate-config --copy`,
	];

	async run(): Promise<void> {
		const { flags } = await this.parse(MigrateConfig);
		const mode = flags.copy ? ("copy" as const) : ("symlink" as const);
		await runMigrateConfig(mode);
	}
}
