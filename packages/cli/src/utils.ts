import childProcess, { SpawnOptionsWithoutStdio } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cancel, log, outro, spinner } from '@clack/prompts';

export function exit(msg?: string, code: number = 0) {
	if (code) cancel(msg);
	else outro(msg);

	process.exit(code);
}

export function exitEarly() {
	exit('Exiting.', 1);
}

export async function copyFile(from: string, to: string) {
	try {
		await fs.copyFile(from, to);
	} catch (e: any) {
		log.error(e.message);
		exit('copy failed', 1);
	}
}

export async function readFile(file: string): Promise<string> {
	try {
		return await fs.readFile(file, 'utf8');
	} catch (e: any) {
		log.error(e.message);
		throw exit('readFile failed', 1);
	}
}

export async function rmFile(file: string) {
	try {
		await fs.rm(file);
	} catch (e: any) {
		log.error(e.message);
		exit('rm failed', 1);
	}
}

export async function writeFile(file: string, data: string) {
	try {
		await fs.writeFile(file, data);
	} catch (e: any) {
		log.error(e.message);
		exit('writeFile failed', 1);
	}
}

export async function appendFile(file: string, data: string) {
	try {
		await fs.appendFile(file, data);
	} catch (e: any) {
		log.error(e.message);
		exit('appendFile failed', 1);
	}
}

export async function mkdir(dir: string) {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch (e: any) {
		log.error(e.message);
		exit('mkdir failed', 1);
	}
}

export async function rmDir(dir: string) {
	try {
		await fs.rm(dir, { recursive: true });
	} catch (e: any) {
		log.error(e.message);
		exit('rmDir failed', 1);
	}
}

export async function mergeCopy(from: string, to: string) {
	try {
		await innerMergeCopy(from, to);
	} catch (e: any) {
		log.error(e.message);
		exit('mergeCopy failed', 1);
	}
}

async function innerMergeCopy(from: string, to: string) {
	const files = await fs.readdir(from);

	for (const file of files) {
		const fromPath = path.join(from, file);
		const toPath = path.join(to, file);

		const stat = await fs.stat(fromPath);

		if (stat.isDirectory()) {
			await fs.mkdir(toPath, { recursive: true });
			await innerMergeCopy(fromPath, toPath);
		} else {
			await fs.copyFile(fromPath, toPath);
		}
	}
}

export async function spawn(
	command: string,
	args: string[],
	opts: SpawnOptionsWithoutStdio = {},
): Promise<{ stdout: string; stderr: string }> {
	const cmdStr = [command, ...args]
		.map(l => (l.includes(' ') ? `"${l}"` : l))
		.map(sanitizeLine)
		.join(' ');
	const shortCmd = trimCmd(cmdStr, 50);
	// Create and start the spinner
	const spin = spinner();
	spin.start(cmdStr);

	return new Promise(resolve => {
		const child = childProcess.spawn(command, args, opts);

		let stdoutData = '';
		let stderrData = '';

		child.stdout.on('data', data => {
			stdoutData += data;
			const lines = stdoutData.split(/\r?\n/);
			const lastLine = lines[lines.length - 1];
			spin.message(
				shortCmd + ' : ' + trimCmd(sanitizeLine(lastLine), 50),
			);
		});

		child.stderr.on('data', data => {
			stderrData += data;
		});

		child.on('close', code => {
			if (code === 0) {
				// Command completed successfully
				spin.stop(cmdStr);
				resolve({
					stdout: stdoutData,
					stderr: stderrData,
				});
			} else {
				// Command exited with an error code
				spin.stop(`${cmdStr}\n${stderrData}`, 1);
				exit('command failed', 1);
			}
		});

		child.on('error', e => {
			spin.stop(`${cmdStr}\n${e.message}`);
			exit(`Command failed`, 1);
		});
	});
}

function sanitizeLine(line: string): string {
	return line.replace(/(\r\n|\n|\r)/gm, '\\n').replace(/[^\x20-\x7E]/g, '');
}

function trimCmd(cmd: string, length: number): string {
	if (cmd.length <= length) return cmd.trim();

	return cmd.substring(0, length).trim() + '...';
}
