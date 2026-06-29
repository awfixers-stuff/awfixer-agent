import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LEGACY_DIR = ".omp";
const NEW_DIR = ".agent";

/** Check if migration is needed and print a one-line hint to stderr. */
export function suggestMigrateConfig(): void {
	const home = os.homedir();
	const newDir = path.join(home, NEW_DIR);
	const legacyDir = path.join(home, LEGACY_DIR);

	// Only show hint when .agent doesn't exist and .omp does
	if (fs.existsSync(newDir)) return;
	if (!fs.existsSync(legacyDir)) return;

	process.stderr.write(
		`Hint: run 'agent migrate-config' to migrate your config from ~/${LEGACY_DIR} to ~/${NEW_DIR}\n`,
	);
}

/**
 * Migrate ~/.omp config to ~/.agent.
 * @param mode "symlink" (default) or "copy"
 */
export async function runMigrateConfig(mode: "copy" | "symlink" = "symlink"): Promise<void> {
	const home = os.homedir();
	const newDir = path.join(home, NEW_DIR);
	const legacyDir = path.join(home, LEGACY_DIR);

	if (!fs.existsSync(legacyDir)) {
		process.stderr.write(`No config found at ~/${LEGACY_DIR} to migrate.\n`);
		process.exit(1);
	}

	if (fs.existsSync(newDir)) {
		process.stderr.write(`~/${NEW_DIR} already exists. Remove it first or migrate manually.\n`);
		process.exit(1);
	}

	if (mode === "symlink") {
		try {
			fs.symlinkSync(legacyDir, newDir, "dir");
			process.stdout.write(
				`Created symlink: ~/${NEW_DIR} → ~/${LEGACY_DIR}\n` +
					`Existing config at ~/${LEGACY_DIR} is now also accessible via ~/${NEW_DIR}.\n`,
			);
		} catch (err) {
			process.stderr.write(`Failed to create symlink: ${(err as Error).message}\n`);
			process.exit(1);
		}
	} else {
		try {
			await fs.promises.cp(legacyDir, newDir, { recursive: true });
			process.stdout.write(
				`Copied ~/${LEGACY_DIR} → ~/${NEW_DIR}\n` +
					`You may now remove ~/${LEGACY_DIR} once you confirm everything works.\n`,
			);
		} catch (err) {
			process.stderr.write(`Failed to copy config: ${(err as Error).message}\n`);
			process.exit(1);
		}
	}
}
