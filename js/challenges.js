/**
 * FORMCOACH AI — CHALLENGES & LEADERBOARD CONTROLLER
 * Community sprint tracker, live push-up rep counter, squat check-in,
 * and user leaderboard position calculation.
 */

import { initSharedNavigation, showToast } from "./shared-nav.js";
import { getUserProfile, getDashboardData } from "./db.js";

let activeUserUid = null;
let currentProfile = null;
let pushupsCount = 75;

initSharedNavigation(async (profile, authUser) => {
  activeUserUid = profile.uid || authUser.uid;
  currentProfile = profile;
  await hydrateLeaderboard();
});

document.addEventListener("DOMContentLoaded", () => {
  setupPushupChallenge();
  setupSquatChallenge();
});

async function hydrateLeaderboard() {
  if (!activeUserUid) return;
  const dashboardData = await getDashboardData(activeUserUid);

  const nameEl = document.getElementById("userRankName");
  const avatarEl = document.getElementById("userRankAvatar");
  const accuracyEl = document.getElementById("userRankAccuracy");

  const name = currentProfile?.displayName || currentProfile?.name || "You (Athlete)";
  if (nameEl) nameEl.textContent = `${name} (You)`;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
  if (accuracyEl) accuracyEl.textContent = `${dashboardData.formAccuracyAvg}% Accuracy`;
}

function setupPushupChallenge() {
  const addBtn = document.getElementById("btnAddPushups25");
  const bar = document.getElementById("pushupBar");
  const text = document.getElementById("pushupProgressText");

  addBtn?.addEventListener("click", () => {
    pushupsCount = Math.min(100, pushupsCount + 25);
    if (bar) bar.style.width = `${pushupsCount}%`;
    if (text) text.textContent = `${pushupsCount} / 100 Reps`;

    if (pushupsCount >= 100) {
      showToast("🏆 Daily 100 Push-Up Challenge COMPLETED! (+150 XP Reward awarded)");
      addBtn.disabled = true;
      addBtn.textContent = "✓ 100 Reps Complete";
    } else {
      showToast(`+25 Push-ups logged! Current: ${pushupsCount}/100 reps.`);
    }
  });
}

function setupSquatChallenge() {
  const squatBtn = document.getElementById("btnLogSquatChallenge");
  const progressText = document.getElementById("chalSquatProgress");

  squatBtn?.addEventListener("click", () => {
    showToast("✓ Squat form scan checked in for today! 19/30 days completed (+20 XP).");
    if (progressText) progressText.textContent = "19 / 30 Days Completed";
    squatBtn.disabled = true;
    squatBtn.textContent = "✓ Checked In Today";
  });
}
