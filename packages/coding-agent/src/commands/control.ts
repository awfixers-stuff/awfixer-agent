/**
 * HTTP control plane for live agent sessions (steer / abort).
 */
import { Args, Command, Flags, renderCommandHelp } from "@awfixerai/utils/cli";
import { type ControlCommandAction, type ControlCommandArgs, runControlCommand } from "../cli/control-cli";
import { initTheme } from "../modes/theme/theme";

const CONTROL_ACTIONS: ControlCommandAction[] = ["serve", "token"];

export default class Control extends Command {
	static description = "HTTP control plane for live agent sessions";

	static args = {
		action: Args.string({
			description: "Sub-command",
			required: false,
			options: [...CONTROL_ACTIONS],
		}),
	};

	static flags = {
		bind: Flags.string({ description: "Bind address (host:port)", char: "b" }),
		"no-auth": Flags.boolean({
			description: "Disable inbound bearer-token auth",
		}),
		"lan-only": Flags.boolean({
			description: "Reject non-LAN client IPs when bound to 0.0.0.0",
		}),
		"no-lan-only": Flags.boolean({
			description: "Allow any client IP",
		}),
		regenerate: Flags.boolean({
			description: "Regenerate the control bearer token (token)",
		}),
	};

	static examples = [
		"agent control serve",
		"agent control serve --bind 0.0.0.0:3848",
		"agent control serve --no-auth",
		"agent control token",
		"agent control token --regenerate",
	];

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Control);
		if (!args.action) {
			renderCommandHelp("agent", "control", Control);
			return;
		}

		const cmd: ControlCommandArgs = {
			action: args.action as ControlCommandAction,
			flags: {
				bind: flags.bind,
				noAuth: flags["no-auth"],
				lanOnly: flags["lan-only"] ? true : undefined,
				noLanOnly: flags["no-lan-only"],
				regenerate: flags.regenerate,
			},
		};

		await initTheme();
		await runControlCommand(cmd);
	}
}
