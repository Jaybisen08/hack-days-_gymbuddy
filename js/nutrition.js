/**
 * FORMCOACH AI — NUTRITION CONTROLLER
 * AI Meal Scanner (Gemini 3.7 Flash), Real-time Macro Aggregators,
 * Hydration Tracker, and Food Diary History Persistence with Firestore.
 */

import { initSharedNavigation, showToast } from "./shared-nav.js";
import {
  getMeals,
  logMeal,
  deleteMeal,
  getUserProfile,
  getWaterIntake,
  updateWaterIntake,
  getTodayDateString
} from "./db.js";

let activeUserUid = null;
let currentProfile = null;
let todayMeals = [];
let waterIntakeMl = 0;
let waterTargetMl = 3000;

let analyzedMealPending = null;
let selectedPhotoBase64 = null;
let selectedPhotoFile = null;

initSharedNavigation(async (profile, authUser) => {
  activeUserUid = profile?.uid || authUser?.uid;
  currentProfile = profile;
  waterTargetMl = profile?.waterGoalMl || 3000;
  await loadNutritionData();
});

document.addEventListener("DOMContentLoaded", () => {
  setupMealScanForm();
  setupWaterTracker();
  setupAddAnalyzedMeal();
});

async function loadNutritionData() {
  if (!activeUserUid) return;
  todayMeals = await getMeals(activeUserUid, getTodayDateString());
  waterIntakeMl = await getWaterIntake(activeUserUid, getTodayDateString());
  calculateAndRenderMacros();
  renderMealsTimeline();
  renderWaterDisplay();
}

function calculateAndRenderMacros() {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFats = 0;

  todayMeals.forEach((meal) => {
    totalCalories += Number(meal.calories) || 0;
    totalProtein += Number(meal.protein) || 0;
    totalCarbs += Number(meal.carbs || meal.carbohydrates) || 0;
    totalFats += Number(meal.fat || meal.fats) || 0;
  });

  const targetCal = currentProfile?.targetCalories || currentProfile?.calorieTarget || 2400;
  const targetProtein = currentProfile?.targetProtein || currentProfile?.proteinTarget || 160;
  const targetCarbs = currentProfile?.targetCarbs || currentProfile?.carbTarget || 260;
  const targetFats = currentProfile?.targetFats || currentProfile?.fatTarget || 65;

  const calValEl = document.getElementById("macroValCalories");
  const proteinValEl = document.getElementById("macroValProtein");
  const carbsValEl = document.getElementById("macroValCarbs");
  const fatsValEl = document.getElementById("macroValFats");

  const calBarEl = document.getElementById("macroBarCalories");
  const proteinBarEl = document.getElementById("macroBarProtein");
  const carbsBarEl = document.getElementById("macroBarCarbs");
  const fatsBarEl = document.getElementById("macroBarFats");

  if (calValEl) calValEl.innerHTML = `${totalCalories.toLocaleString()} <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">/ ${targetCal.toLocaleString()} kcal</span>`;
  if (proteinValEl) proteinValEl.innerHTML = `${totalProtein}g <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">/ ${targetProtein}g</span>`;
  if (carbsValEl) carbsValEl.innerHTML = `${totalCarbs}g <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">/ ${targetCarbs}g</span>`;
  if (fatsValEl) fatsValEl.innerHTML = `${totalFats}g <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">/ ${targetFats}g</span>`;

  if (calBarEl) calBarEl.style.width = `${Math.min(100, Math.round((totalCalories / targetCal) * 100))}%`;
  if (proteinBarEl) proteinBarEl.style.width = `${Math.min(100, Math.round((totalProtein / targetProtein) * 100))}%`;
  if (carbsBarEl) carbsBarEl.style.width = `${Math.min(100, Math.round((totalCarbs / targetCarbs) * 100))}%`;
  if (fatsBarEl) fatsBarEl.style.width = `${Math.min(100, Math.round((totalFats / targetFats) * 100))}%`;
}

function renderMealsTimeline() {
  const container = document.getElementById("mealsTimelineContainer");
  const badge = document.getElementById("loggedMealsCountBadge");

  if (badge) badge.textContent = `${todayMeals.length} ${todayMeals.length === 1 ? "meal" : "meals"}`;
  if (!container) return;

  if (todayMeals.length === 0) {
    container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 24px; border: 1px dashed var(--border-subtle); border-radius: var(--radius-sm);">No meals logged today yet.<br/><span style="font-size: 0.76rem; color: #9CA3AF;">Describe your meal or upload a photo above to log macros.</span></div>`;
    return;
  }

  container.innerHTML = todayMeals
    .map(
      (m) => `
    <div style="background: #FAFAFA; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
      <div style="flex: 1; min-width: 0; padding-right: 10px;">
        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(m.mealName || m.name || "Logged Meal")}</div>
        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 3px;">
          ${escapeHtml(m.mealType || m.category || "Meal")} • P: ${m.protein || 0}g | C: ${m.carbs || m.carbohydrates || 0}g | F: ${m.fat || m.fats || 0}g
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="badge-tag badge-accent" style="white-space: nowrap;">${m.calories || 0} kcal</span>
        <button type="button" class="btn-delete-meal" data-meal-id="${m.id}" style="background: none; border: none; cursor: pointer; color: #9CA3AF; padding: 4px; font-size: 0.9rem;" title="Delete meal">✕</button>
      </div>
    </div>
  `
    )
    .join("");

  // Attach delete handlers
  container.querySelectorAll(".btn-delete-meal").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const mealId = btn.getAttribute("data-meal-id");
      if (!mealId || !activeUserUid) return;
      todayMeals = await deleteMeal(activeUserUid, mealId);
      calculateAndRenderMacros();
      renderMealsTimeline();
      showToast("Meal removed from food diary.");
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}

// 2. AI MEAL SCANNER WITH GEMINI VISION
function setupMealScanForm() {
  const form = document.getElementById("mealScanForm");
  const mealDesc = document.getElementById("mealDescriptionInput");
  const mealType = document.getElementById("mealTypeSelect");
  const photoInput = document.getElementById("mealPhotoInput");
  const dropArea = document.getElementById("photoDropArea");
  const promptState = document.getElementById("photoPromptState");
  const previewContainer = document.getElementById("photoPreviewContainer");
  const previewImg = document.getElementById("mealPhotoPreviewImg");
  const fileNameEl = document.getElementById("photoFileName");
  const fileSizeEl = document.getElementById("photoFileSize");
  const uploadStatusEl = document.getElementById("photoUploadStatus");
  const removeBtn = document.getElementById("btnRemovePhoto");
  const submitBtn = document.getElementById("btnAnalyzeMeal");

  // Drop area click to trigger file selector
  dropArea?.addEventListener("click", (e) => {
    if (e.target === removeBtn || removeBtn?.contains(e.target)) return;
    photoInput?.click();
  });

  // Drag & drop handlers
  ["dragenter", "dragover"].forEach((eventName) => {
    dropArea?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.style.borderColor = "var(--accent)";
      dropArea.style.background = "#F4F5F7";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropArea?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.style.borderColor = "var(--border-subtle)";
      dropArea.style.background = "var(--bg-subtle)";
    });
  });

  dropArea?.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const file = dt?.files?.[0];
    if (file) handleSelectedPhoto(file);
  });

  photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleSelectedPhoto(file);
  });

  function handleSelectedPhoto(file) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      showToast("Please upload a valid image (JPEG, PNG, or WebP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast("Photo exceeds 15MB limit. Please choose a smaller image.");
      return;
    }

    selectedPhotoFile = file;
    const reader = new FileReader();

    if (uploadStatusEl) {
      uploadStatusEl.textContent = "Processing image...";
      uploadStatusEl.style.color = "var(--accent)";
    }

    reader.onload = (ev) => {
      selectedPhotoBase64 = ev.target.result;
      if (previewImg) previewImg.src = selectedPhotoBase64;
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      if (uploadStatusEl) {
        uploadStatusEl.textContent = "✓ Photo loaded & ready for analysis";
        uploadStatusEl.style.color = "#10B981";
      }

      if (promptState) promptState.style.display = "none";
      if (previewContainer) previewContainer.style.display = "flex";

      showToast("Photo attached! Click Analyze to calculate nutritional breakdown.");
    };

    reader.readAsDataURL(file);
  }

  removeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedPhotoFile = null;
    selectedPhotoBase64 = null;
    if (photoInput) photoInput.value = "";
    if (previewContainer) previewContainer.style.display = "none";
    if (promptState) promptState.style.display = "block";
    showToast("Photo removed.");
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = mealDesc?.value?.trim() || "";
    if (!text && !selectedPhotoBase64) {
      showToast("Please enter a meal description or attach a plate photo.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Gemini 3.7 Vision analyzing plate components...</span>`;
    }

    try {
      const response = await fetch("/api/gemini/analyze-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealDescription: text,
          mealType: mealType?.value || "Lunch",
          image: selectedPhotoBase64,
          calorieTarget: currentProfile?.targetCalories || 2400,
          proteinTarget: currentProfile?.targetProtein || 160,
        }),
      });

      const data = await response.json();
      if (data.error) {
        showToast(data.error || "Failed to analyze meal.");
        return;
      }

      const foods = Array.isArray(data.foods) && data.foods.length > 0 
        ? data.foods 
        : (Array.isArray(data.detectedFoods) && data.detectedFoods.length > 0 ? data.detectedFoods : (data.mealName ? [data.mealName] : []));

      const nut = data.nutrition || {};
      const calories = data.calories ?? nut.calories ?? null;
      const protein = data.protein ?? nut.protein ?? null;
      const carbs = data.carbohydrates ?? data.carbs ?? nut.carbohydrates ?? nut.carbs ?? null;
      const fat = data.fat ?? data.fats ?? nut.fat ?? nut.fats ?? null;
      const fiber = data.fiber ?? nut.fiber ?? null;
      const insight = data.insight ?? data.aiInsight ?? data.recommendations ?? null;

      analyzedMealPending = {
        mealName: data.mealName || text.slice(0, 35) || "Logged Meal",
        category: mealType?.value || "Lunch",
        mealType: mealType?.value || "Lunch",
        foods: foods,
        detectedFoods: foods,
        nutrition: {
          calories,
          protein,
          carbohydrates: carbs,
          fat,
          fiber,
        },
        calories: calories !== null ? Number(calories) : null,
        protein: protein !== null ? Number(protein) : null,
        carbs: carbs !== null ? Number(carbs) : null,
        carbohydrates: carbs !== null ? Number(carbs) : null,
        fat: fat !== null ? Number(fat) : null,
        fats: fat !== null ? Number(fat) : null,
        fiber: fiber !== null ? Number(fiber) : null,
        healthScore: data.healthScore !== undefined ? Number(data.healthScore) : null,
        qualityScore: data.healthScore !== undefined ? Number(data.healthScore) : null,
        aiInsight: insight,
        insight: insight,
        image: selectedPhotoBase64,
      };

      renderAnalysisCard(analyzedMealPending);
      const summaryCal = analyzedMealPending.calories !== null ? `${analyzedMealPending.calories} kcal` : "--";
      const summaryPro = analyzedMealPending.protein !== null ? `${analyzedMealPending.protein}g protein` : "--";
      showToast(`Analysis complete: ${summaryCal} • ${summaryPro}`);
    } catch (err) {
      console.error("Meal scan error:", err);
      showToast("Unable to reach AI service. Please check network connection.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Analyze & Calculate Macros</span> <span>→</span>`;
      }
    }
  });
}

function renderAnalysisCard(meal) {
  const card = document.getElementById("mealAnalysisCard");
  const nameEl = document.getElementById("analyzedMealName");
  const catEl = document.getElementById("analyzedMealCategory");
  const qualityEl = document.getElementById("mealQualityBadge");
  const detectedChipsContainer = document.getElementById("detectedFoodsList");
  const calEl = document.getElementById("resCalories");
  const pEl = document.getElementById("resProtein");
  const cEl = document.getElementById("resCarbs");
  const fEl = document.getElementById("resFats");
  const fiberEl = document.getElementById("resFiber");
  const advEl = document.getElementById("resAdvice");

  if (nameEl) nameEl.textContent = meal.mealName || "--";
  if (catEl) catEl.textContent = `${meal.category || meal.mealType || "Meal"} • AI Biometric Macro Scan`;
  if (qualityEl) {
    if (meal.healthScore !== null && meal.healthScore !== undefined) {
      qualityEl.textContent = `Quality ${meal.healthScore}/10`;
      qualityEl.style.display = "inline-flex";
    } else {
      qualityEl.textContent = "AI Evaluated";
    }
  }
  
  if (calEl) calEl.textContent = meal.calories !== null && meal.calories !== undefined ? `${meal.calories} kcal` : "--";
  if (pEl) pEl.textContent = meal.protein !== null && meal.protein !== undefined ? `${meal.protein}g` : "--";
  const carbVal = meal.carbs ?? meal.carbohydrates ?? null;
  if (cEl) cEl.textContent = carbVal !== null && carbVal !== undefined ? `${carbVal}g` : "--";
  const fatVal = meal.fat ?? meal.fats ?? null;
  if (fEl) fEl.textContent = fatVal !== null && fatVal !== undefined ? `${fatVal}g` : "--";
  if (fiberEl) fiberEl.textContent = meal.fiber !== null && meal.fiber !== undefined ? `${meal.fiber}g` : "--";
  if (advEl) advEl.textContent = meal.aiInsight || meal.insight || "--";

  if (detectedChipsContainer) {
    const foods = meal.foods || meal.detectedFoods || [];
    if (foods.length > 0) {
      detectedChipsContainer.innerHTML = foods
        .map(
          (f) => `
        <span style="background: #E5E7EB; color: var(--text-primary); font-size: 0.74rem; font-weight: 600; padding: 3px 8px; border-radius: 9999px;">
          ${escapeHtml(f)}
        </span>
      `
        )
        .join("");
    } else {
      detectedChipsContainer.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-secondary);">No specific ingredients isolated</span>`;
    }
  }

  if (card) {
    card.style.display = "flex";
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function setupAddAnalyzedMeal() {
  const logBtn = document.getElementById("btnLogAnalyzedMeal");
  logBtn?.addEventListener("click", async () => {
    if (!analyzedMealPending || !activeUserUid) return;

    logBtn.disabled = true;
    logBtn.textContent = "Saving to Daily Diary...";

    await logMeal(activeUserUid, analyzedMealPending);
    todayMeals = await getMeals(activeUserUid, getTodayDateString());
    calculateAndRenderMacros();
    renderMealsTimeline();

    showToast("✓ Meal logged to food diary! (+30 XP)");
    const card = document.getElementById("mealAnalysisCard");
    if (card) card.style.display = "none";
    analyzedMealPending = null;
    logBtn.disabled = false;
    logBtn.textContent = "+ Add to Today's Food Diary";
  });
}

// 3. WATER TRACKER
function setupWaterTracker() {
  const add250 = document.getElementById("btnAddWater250");
  const add500 = document.getElementById("btnAddWater500");
  const resetBtn = document.getElementById("btnResetWater");

  const handleWaterDelta = async (delta) => {
    if (!activeUserUid) return;
    waterIntakeMl = await updateWaterIntake(activeUserUid, delta, getTodayDateString());
    renderWaterDisplay();
    showToast(delta === 0 ? "Hydration counter reset." : `+${delta}ml water logged!`);
  };

  add250?.addEventListener("click", () => handleWaterDelta(250));
  add500?.addEventListener("click", () => handleWaterDelta(500));
  resetBtn?.addEventListener("click", () => handleWaterDelta(0));
}

function renderWaterDisplay() {
  const amountEl = document.getElementById("waterAmountText");
  const badgeEl = document.getElementById("waterStatusBadge");

  if (amountEl) {
    amountEl.innerHTML = `${waterIntakeMl.toLocaleString()} <span style="font-size: 1rem; color: var(--text-secondary); font-weight: 600;">/ ${waterTargetMl.toLocaleString()} ml</span>`;
  }

  const pct = Math.round((waterIntakeMl / waterTargetMl) * 100);
  if (badgeEl) {
    badgeEl.textContent = `${pct}% Target`;
    badgeEl.className = pct >= 100 ? "badge-tag badge-green" : "badge-tag badge-accent";
  }
}
