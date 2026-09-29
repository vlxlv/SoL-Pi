/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

import { getAgentDir, type ExtensionAPI, type ExtensionContext, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { registerSolPiCommands } from "./command.ts";
import { DEFAULT_CONFIG, loadSolPiConfig, type SolPiConfig } from "./config.ts";
import { registerActionFusion } from "./extensions/action-fusion/index.ts";
import { registerEvidencePreservingReducer } from "./extensions/evidence-preserving-reducer/index.ts";
import { registerObservationPack } from "./extensions/observation-pack/index.ts";
import { registerOnlineContextCompact } from "./extensions/online-context-compact/index.ts";
import { updateSolPiStatusBar } from "./tui.ts";

export function registerConfiguredFeatures(pi: ExtensionAPI, config: SolPiConfig): void {
	if (config.actionFusion) registerActionFusion(pi);
	if (config.observationPack) registerObservationPack(pi);
	if (config.evidencePreservingReducer) {
		registerEvidencePreservingReducer(pi, {
			reducerModel: config.evidencePreservingReducerModel,
			reducerProvider: config.evidencePreservingReducerProvider,
		});
	}
	if (config.onlineContextCompact) registerOnlineContextCompact(pi, config.cacheWriteReadRatio);
}

export type SolPiConfigLoader = (ctx: ExtensionContext) => SolPiConfig;

export function createSolPiExtension(
	loadConfig: SolPiConfigLoader = (ctx) => loadSolPiConfig(ctx.cwd, getAgentDir(), ctx.isProjectTrusted()),
): ExtensionFactory {
	return (pi) => {
		let initialized = false;
		let currentConfig: SolPiConfig = DEFAULT_CONFIG;

		if (typeof pi.registerCommand === "function") {
			registerSolPiCommands(pi, {
				getConfig: () => currentConfig,
				setConfig: (updated) => {
					currentConfig = updated;
				},
			});
		}

		pi.on("session_start", (_event, ctx) => {
			if (!initialized) {
				initialized = true;
				currentConfig = loadConfig(ctx);
				registerConfiguredFeatures(pi, currentConfig);

				if (ctx.mode === "tui") {
					const isAnyActive =
						currentConfig.actionFusion ||
						currentConfig.observationPack ||
						currentConfig.onlineContextCompact ||
						currentConfig.evidencePreservingReducer;
					if (isAnyActive) {
						ctx.ui.notify("⚡ SoL-Pi loaded: active", "info");
					} else {
						ctx.ui.notify("⚡ SoL-Pi loaded: off (/sol-pi on to enable)", "info");
					}
				}
			}
			updateSolPiStatusBar(ctx, currentConfig);
		});
	};
}

export default function solPiExtension(pi: ExtensionAPI): void {
	createSolPiExtension()(pi);
}
