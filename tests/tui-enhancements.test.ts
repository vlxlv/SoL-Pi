/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSolPiCommands } from "../src/sol-pi/command.ts";
import { DEFAULT_CONFIG, loadSolPiConfig, RECOMMENDED_CONFIG, type SolPiConfig } from "../src/sol-pi/config.ts";
import { getStats, recordSavings, resetStats } from "../src/sol-pi/stats.ts";
import {
	formatTokensAbbreviated,
	getSolPiStatusText,
	SOL_PI_STATUS_KEY,
	updateSolPiStatusBar,
} from "../src/sol-pi/tui.ts";

describe("SoL-Pi TUI enhancements & stats", () => {
	beforeEach(() => {
		resetStats();
	});

	afterEach(() => {
		resetStats();
		delete process.env.SOL_PI_AUTO;
	});

	it("formats token counts compactly", () => {
		expect(formatTokensAbbreviated(500)).toBe("500 tokens");
		expect(formatTokensAbbreviated(1_500)).toBe("1.5k tokens");
		expect(formatTokensAbbreviated(250_000)).toBe("250k tokens");
		expect(formatTokensAbbreviated(2_300_000)).toBe("2.3M tokens");
	});

	it("generates appropriate status bar text based on active mechanisms and provider", () => {
		// When completely disabled
		expect(getSolPiStatusText(DEFAULT_CONFIG)).toBe("⚡ SoL-Pi (off · /sol-pi)");

		// When features enabled
		const activeConfig: SolPiConfig = {
			...DEFAULT_CONFIG,
			actionFusion: true,
			observationPack: true,
		};
		expect(getSolPiStatusText(activeConfig)).toBe("⚡ SoL-Pi [Fusion|Pack]");

		// When running under AGY provider
		expect(getSolPiStatusText(activeConfig, "agy")).toBe("⚡ SoL-Pi [Fusion|Pack] · AGY active");
		expect(getSolPiStatusText(activeConfig, "pi-agy-pool")).toBe("⚡ SoL-Pi [Fusion|Pack] · AGY active");

		// When savings have accumulated
		recordSavings("Action Fusion", "1 model round-trip avoided");
		recordSavings("Observation Pack", "4,200 context tokens avoided");
		expect(getSolPiStatusText(activeConfig)).toBe("⚡ SoL-Pi [Fusion|Pack] · saved 1 turn, 4.2k tokens");
	});

	it("updates status bar on ExtensionContext in tui mode", () => {
		const setStatus = vi.fn();
		const ctx = {
			mode: "tui",
			model: { provider: "anthropic" },
			ui: { setStatus },
		} as unknown as ExtensionContext;

		updateSolPiStatusBar(ctx, RECOMMENDED_CONFIG);
		expect(setStatus).toHaveBeenCalledWith(SOL_PI_STATUS_KEY, "⚡ SoL-Pi [Fusion|Pack|Compact]");
	});

	it("does not update status bar in non-tui modes", () => {
		const setStatus = vi.fn();
		const ctx = {
			mode: "json",
			ui: { setStatus },
		} as unknown as ExtensionContext;

		updateSolPiStatusBar(ctx, RECOMMENDED_CONFIG);
		expect(setStatus).not.toHaveBeenCalled();
	});

	it("records savings across different mechanisms accurately", () => {
		recordSavings("Action Fusion", "1 model round-trip avoided");
		recordSavings("Action Fusion", "1 model round-trip avoided");
		recordSavings("Observation Pack", "12,500 context tokens avoided");
		recordSavings("Luna Delegating", "45.5 KiB removed from future prompts");

		const stats = getStats();
		expect(stats.roundTripsAvoided).toBe(2);
		expect(stats.observationsPacked).toBe(1);
		expect(stats.tokensSaved).toBe(12_500);
		expect(stats.bytesSaved).toBe(Math.round(45.5 * 1024));
	});

	it("supports SOL_PI_AUTO environment variable to enable recommended defaults", () => {
		const root = mkdtempSync(join(tmpdir(), "sol-pi-auto-"));
		try {
			// Without env var -> DEFAULT_CONFIG
			delete process.env.SOL_PI_AUTO;
			expect(loadSolPiConfig(root, root, true)).toEqual(DEFAULT_CONFIG);

			// With env var -> RECOMMENDED_CONFIG
			process.env.SOL_PI_AUTO = "1";
			expect(loadSolPiConfig(root, root, true)).toEqual(RECOMMENDED_CONFIG);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("registers and handles /sol-pi slash command", async () => {
		const notify = vi.fn();
		const setStatus = vi.fn();
		const reload = vi.fn();
		let currentConfig = DEFAULT_CONFIG;

		const commands = new Map<string, { handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> }>();
		const fakePi = {
			registerCommand: (name: string, opts: any) => {
				commands.set(name, opts);
			},
		};

		registerSolPiCommands(fakePi as any, {
			getConfig: () => currentConfig,
			setConfig: (cfg) => {
				currentConfig = cfg;
			},
		});

		expect(commands.has("sol-pi")).toBe(true);
		const handler = commands.get("sol-pi")!.handler;

		const cmdCtx = {
			mode: "tui",
			model: { provider: "openai", id: "gpt-4o" },
			ui: { notify, setStatus },
			reload,
		} as unknown as ExtensionCommandContext;

		// 1. /sol-pi status
		await handler("status", cmdCtx);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("⚡ SoL-Pi Status & Savings"), "info");

		// 2. /sol-pi on
		await handler("on", cmdCtx);
		expect(currentConfig.actionFusion).toBe(true);
		expect(currentConfig.observationPack).toBe(true);
		expect(currentConfig.onlineContextCompact).toBe(true);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("⚡ SoL-Pi enabled!"), "info");

		// 3. /sol-pi off
		await handler("off", cmdCtx);
		expect(currentConfig.actionFusion).toBe(false);
		expect(currentConfig.observationPack).toBe(false);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("⚡ SoL-Pi disabled."), "info");
	});
});
