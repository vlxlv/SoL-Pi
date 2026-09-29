/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

export interface SolPiStats {
	roundTripsAvoided: number;
	observationsPacked: number;
	tokensSaved: number;
	bytesSaved: number;
}

export const sessionStats: SolPiStats = {
	roundTripsAvoided: 0,
	observationsPacked: 0,
	tokensSaved: 0,
	bytesSaved: 0,
};

export function recordSavings(mechanism: string, saving: string): void {
	if (mechanism === "Action Fusion") {
		sessionStats.roundTripsAvoided += 1;
		return;
	}

	if (mechanism === "Observation Pack") {
		sessionStats.observationsPacked += 1;
		const tokenMatch = saving.match(/([\d,]+)\s+context tokens/u);
		if (tokenMatch?.[1]) {
			const num = parseInt(tokenMatch[1].replace(/,/gu, ""), 10);
			if (Number.isFinite(num)) sessionStats.tokensSaved += num;
		}
		return;
	}

	if (mechanism === "Online Context Compact") {
		const tokenMatch = saving.match(/([\d,]+)\s+context tokens/u);
		if (tokenMatch?.[1]) {
			const num = parseInt(tokenMatch[1].replace(/,/gu, ""), 10);
			if (Number.isFinite(num)) sessionStats.tokensSaved += num;
		}
		return;
	}

	if (mechanism === "Luna Delegating" || mechanism === "Evidence-Preserving Reducer") {
		const byteMatch = saving.match(/([\d.]+)\s*(KiB|MiB|B)/u);
		if (byteMatch?.[1] && byteMatch[2]) {
			const val = parseFloat(byteMatch[1]);
			const unit = byteMatch[2];
			const multiplier = unit === "MiB" ? 1024 * 1024 : unit === "KiB" ? 1024 : 1;
			sessionStats.bytesSaved += Math.round(val * multiplier);
		}
	}
}

export function getStats(): Readonly<SolPiStats> {
	return sessionStats;
}

export function resetStats(): void {
	sessionStats.roundTripsAvoided = 0;
	sessionStats.observationsPacked = 0;
	sessionStats.tokensSaved = 0;
	sessionStats.bytesSaved = 0;
}
