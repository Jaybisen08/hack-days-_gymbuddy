/**
 * GYMBUDDY — SETTINGS CONTROLLER
 * Athlete Profile Persistence, Preference Toggles,
 * Full Data Export (JSON format), and Demo Session Management.
 */

import { initSharedNavigation, showToast } from "./shared-nav.js";
import { getUserProfile, saveUserProfile, getDashboardData, getWorkouts, getFormAnalyses, getNutritionMeals } from "./db.js";

let activeUserUid = null;
let currentProfile = null;

initSharedNavigation(async (profile, authUser) => {
  activeUserUid = profile.uid || authUser.uid;
  currentProfile = profile;
  hydrateSettingsForm(profile);
});

document.addEventListener("DOMContentLoaded", () => {
  setupSettingsForm();
  setupExportData();
  setupSignOutAction();
});

function hydrateSettingsForm(profile) {
  const nameInput = document.getElementById("setDisplayName");
  const emailInput = document.getElementById("setEmail");
  const goalSelect = document.getElementById("setGoal");
  const expSelect = document.getElementById("setExperience");
  const weightInput = document.getElementById("setWeight");
  const targetWeightInput = document.getElementById("setTargetWeight");
  const calTargetInput = document.getElementById("setCalTarget");
  const proteinTargetInput = document.getElementById("setProteinTarget");

  if (nameInput) nameInput.value = profile.displayName || profile.name || "Athlete";
  if (emailInput) emailInput.value = profile.email || "athlete@gymbuddy.ai";
  if (goalSelect && profile.goal) goalSelect.value = profile.goal;
  if (expSelect && profile.experienceLevel) expSelect.value = profile.experienceLevel;
  if (weightInput) weightInput.value = profile.weight || 81.5;
  if (targetWeightInput) targetWeightInput.value = profile.targetWeight || 78.0;
  if (calTargetInput) calTargetInput.value = profile.calorieTarget || 2600;
  if (proteinTargetInput) proteinTargetInput.value = profile.proteinTarget || 190;
}

function setupSettingsForm() {
  const form = document.getElementById("settingsProfileForm");
  const saveBtn = document.getElementById("btnSaveProfile");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeUserUid) return;

    const updated = {
      displayName: document.getElementById("setDisplayName")?.value?.trim() || "Athlete",
      goal: document.getElementById("setGoal")?.value || "Muscle Hypertrophy",
      experienceLevel: document.getElementById("setExperience")?.value || "Intermediate",
      weight: parseFloat(document.getElementById("setWeight")?.value || "81.5"),
      targetWeight: parseFloat(document.getElementById("setTargetWeight")?.value || "78.0"),
      calorieTarget: parseInt(document.getElementById("setCalTarget")?.value || "2600", 10),
      proteinTarget: parseInt(document.getElementById("setProteinTarget")?.value || "190", 10),
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Saving to Firestore...</span>`;
    }

    await saveUserProfile(activeUserUid, updated);
    showToast("✓ Athlete profile & biometric targets saved successfully!");

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>Save Athlete Profile</span> <span>✓</span>`;
    }
  });
}

function setupExportData() {
  const exportBtn = document.getElementById("btnExportData");
  exportBtn?.addEventListener("click", async () => {
    if (!activeUserUid) return;

    exportBtn.disabled = true;
    exportBtn.textContent = "Compiling Data Bundle...";

    const dashboard = await getDashboardData(activeUserUid);
    const workouts = await getWorkouts(activeUserUid);
    const scans = await getFormAnalyses(activeUserUid);
    const meals = await getNutritionMeals(activeUserUid);

    const exportBundle = {
      profile: currentProfile,
      dashboard,
      workouts,
      formScans: scans,
      nutritionMeals: meals,
      exportedAt: new Date().toISOString(),
      platform: "GymBuddy Web App",
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `gymbuddy_athlete_data_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    exportBtn.disabled = false;
    exportBtn.textContent = "📥 Export Complete Athlete Data (JSON)";
    showToast("Athlete data exported successfully!");
  });
}

function setupSignOutAction() {
  const signoutBtn = document.getElementById("btnSignOutFull");
  signoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("gymbuddy_active_user");
    localStorage.removeItem("formcoach_demo_user");
    window.location.href = "login.html";
  });
}
