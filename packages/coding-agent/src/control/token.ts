import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isEnoent } from "@awfixerai/utils";
import { getControlTokenPath } from "./constants";

function generateToken(): string {
	return crypto.randomBytes(32).toString("base64url");
}

export async function readControlToken(): Promise<string | null> {
	try {
		const raw = await Bun.file(getControlTokenPath()).text();
		const trimmed = raw.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
}

async function writeControlToken(token: string): Promise<void> {
	const file = getControlTokenPath();
	await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
	await fs.writeFile(file, token, { mode: 0o600 });
	try {
		await fs.chmod(file, 0o600);
	} catch {
		// Best-effort.
	}
}

async function createControlTokenExclusive(token: string): Promise<boolean> {
	const file = getControlTokenPath();
	await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
	try {
		await fs.writeFile(file, token, { flag: "wx", mode: 0o600 });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
		throw err;
	}
	try {
		await fs.chmod(file, 0o600);
	} catch {
		// Best-effort.
	}
	return true;
}

export async function ensureControlToken(): Promise<string> {
	const existing = await readControlToken();
	if (existing) return existing;
	const token = generateToken();
	if (await createControlTokenExclusive(token)) return token;
	const fromRace = await readControlToken();
	if (fromRace) return fromRace;
	await writeControlToken(token);
	return token;
}

export async function regenerateControlToken(): Promise<string> {
	const token = generateToken();
	await writeControlToken(token);
	return token;
}
