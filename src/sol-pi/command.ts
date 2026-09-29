/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SolPiConfig } from "./config.ts";
import { getStats } from "./stats.ts";
import { updateSolPiStatusBar } from "./tui.ts";

export interface SolPiCommandOptions {
	getConfig: () => SolPiConfig;
	setConfig: (config: SolPiConfig) => void;
}

export function registerSolPiCommands(
	pi: ExtensionAPI,
	options: SolPiCommandOptions,
): void {
	pi.registerCommand("sol-pi", {
		description: "Manage SoL-Pi efficiency mechanisms and view token savings",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const command = args.trim().toLowerCase();
			const config = options.getConfig();

			if (command === "on" || command === "enable") {
				const agentDir = getAgentDir();
				if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
				const configPath = join(agentDir, "sol-pi.json");
				const updatedConfig: SolPiConfig = {
					...config,
					version: 1,
					actionFusion: true,
					observationPack: true,
					onlineContextCompact: true,
				};
				writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), "utf8");
				options.setConfig(updatedConfig);
				updateSolPiStatusBar(ctx, updatedConfig);

				ctx.ui.notify(
					`⚡ SoL-Pi enabled!\nAction Fusion, Observation Pack, and Online Compact are now active.\nConfig saved to: ${configPath}\n\nTip: You can now restart or reload Pi to attach fused tools.`,
					"info",
				);

				if (typeof ctx.reload === "function") {
					try {
						await ctx.reload();
					} catch {
						// Fail gracefully if reload is unavailable
					}
				}
				return;
			}

			if (command === "all") {
				const agentDir = getAgentDir();
				if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
				const configPath = join(agentDir, "sol-pi.json");
				const updatedConfig: SolPiConfig = {
					...config,
					version: 1,
					actionFusion: true,
					observationPack: true,
					evidencePreservingReducer: true,
					onlineContextCompact: true,
				};
				writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), "utf8");
				options.setConfig(updatedConfig);
				updateSolPiStatusBar(ctx, updatedConfig);

				ctx.ui.notify(
					`⚡ SoL-Pi ALL enabled!\nAll 4 mechanisms (Fusion, Pack, Reducer, Compact) are now active.\nConfig saved to: ${configPath}`,
					"info",
				);

				if (typeof ctx.reload === "function") {
					try {
						await ctx.reload();
					} catch {
						// Fail gracefully
					}
				}
				return;
			}

			if (command === "off" || command === "disable") {
				const agentDir = getAgentDir();
				if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
				const configPath = join(agentDir, "sol-pi.json");
				const updatedConfig: SolPiConfig = {
					...config,
					version: 1,
					actionFusion: false,
					observationPack: false,
					evidencePreservingReducer: false,
					onlineContextCompact: false,
				};
				writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), "utf8");
				options.setConfig(updatedConfig);
				updateSolPiStatusBar(ctx, updatedConfig);

				ctx.ui.notify(`⚡ SoL-Pi disabled.\nConfig saved to: ${configPath}`, "info");

				if (typeof ctx.reload === "function") {
					try {
						await ctx.reload();
					} catch {
						// Fail gracefully
					}
				}
				return;
			}

			const stats = getStats();
			const lines: string[] = [
				"⚡ SoL-Pi Status & Savings",
				"────────────────────────────────────────",
				`• Action Fusion:     ${config.actionFusion ? "✔ Enabled" : "✗ Disabled"}`,
				`• Observation Pack:  ${config.observationPack ? "✔ Enabled" : "✗ Disabled"}`,
				`• Evidence Reducer:  ${config.evidencePreservingReducer ? "✔ Enabled" : "✗ Disabled"}`,
				`• Context Compact:   ${config.onlineContextCompact ? "✔ Enabled" : "✗ Disabled"}`,
				"",
				"📊 Session Statistics:",
				`• Avoided model round-trips: ${stats.roundTripsAvoided}`,
				`• Large observations packed: ${stats.observationsPacked}`,
				`• Context tokens saved:      ${stats.tokensSaved.toLocaleString()}`,
			];

			if (stats.bytesSaved > 0) {
				lines.push(`• Output bytes trimmed:      ${(stats.bytesSaved / 1024).toFixed(1)} KiB`);
			}

			const provider = ctx.model?.provider ?? "unknown";
			const modelId = ctx.model?.id ?? "unknown";
			lines.push("", `Active Provider / Model: ${provider} / ${modelId}`);

			if (provider === "agy" || provider === "pi-agy-pool" || provider.includes("agy")) {
				lines.push(
					"",
					"ℹ Current provider is AGY (Google Antigravity).",
					"  AGY executes tools autonomously inside its own engine.",
				);
			}

			lines.push(
				"",
				"Usage:",
				"  /sol-pi on      - Enable recommended features (Fusion, Pack, Compact)",
				"  /sol-pi all     - Enable ALL 4 features (Fusion, Pack, Reducer, Compact)",
				"  /sol-pi off     - Disable all features",
				"  /sol-pi status  - Show this status and savings summary",
			);

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
