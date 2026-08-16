/**
 * GYMBUDDY — INSTANT DEMO LOGIN CONTROLLER
 * Zero backend auth dependencies. 1-click athlete session initialization.
 */

// Preset Demo Personas
const DEMO_PERSONAS = {
  alex: {
    uid: "demo-athlete-alex",
    displayName: "Alex Johnson",
    email: "alex.athlete@gymbuddy.ai",
    goal: "Build Muscle & Strength",
    experienceLevel: "Intermediate",
    weight: 78.5,
    targetWeight: 75.0,
    calorieTarget: 2500,
    proteinTarget: 175,
  },
  marcus: {
    uid: "demo-athlete-marcus",
    displayName: "Marcus Vance",
    email: "marcus.power@gymbuddy.ai",
    goal: "Maximum Strength & Hypertrophy",
    experienceLevel: "Advanced",
    weight: 88.0,
    targetWeight: 86.0,
    calorieTarget: 3100,
    proteinTarget: 210,
  },
  elena: {
    uid: "demo-athlete-elena",
    displayName: "Elena Rostova",
    email: "elena.hyrox@gymbuddy.ai",
    goal: "Conditioning & Endurance",
    experienceLevel: "Advanced",
    weight: 63.5,
    targetWeight: 62.0,
    calorieTarget: 2200,
    proteinTarget: 145,
  },
};

function loginAsAthlete(athleteData) {
  const sessionUser = {
    uid: athleteData.uid,
    displayName: athleteData.displayName,
    email: athleteData.email,
    photoURL: null,
    isDemo: true,
  };

  localStorage.setItem("gymbuddy_active_user", JSON.stringify(sessionUser));
  localStorage.setItem("formcoach_demo_user", JSON.stringify(sessionUser));

  // Initialize or save profile details in storage
  const profileKey = `gymbuddy_${athleteData.uid}_profile`;
  const existingProfile = localStorage.getItem(profileKey);
  if (!existingProfile) {
    localStorage.setItem(
      profileKey,
      JSON.stringify({
        ...athleteData,
        streakDays: 4,
        totalWorkouts: 18,
        totalCaloriesBurned: 7420,
        formAccuracyAvg: 92,
        xpPoints: 1850,
        tier: "Gold Athlete",
        createdAt: new Date().toISOString(),
      })
    );
  }

  // Redirect to dashboard
  window.location.href = "dashboard.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Primary Instant Demo Button
  const primaryDemoBtn = document.getElementById("primaryDemoLoginBtn");
  primaryDemoBtn?.addEventListener("click", () => {
    loginAsAthlete(DEMO_PERSONAS.alex);
  });

  // 2. Persona Card Clicks
  document.querySelectorAll("[data-persona]").forEach((card) => {
    card.addEventListener("click", () => {
      const personaKey = card.getAttribute("data-persona");
      if (DEMO_PERSONAS[personaKey]) {
        loginAsAthlete(DEMO_PERSONAS[personaKey]);
      }
    });
  });

  // 3. Custom Athlete Name Form
  const customForm = document.getElementById("customAthleteForm");
  customForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("customAthleteName");
    const nameVal = nameInput?.value?.trim() || "Athlete";
    const customAthlete = {
      uid: `demo-athlete-${Date.now()}`,
      displayName: nameVal,
      email: `${nameVal.toLowerCase().replace(/\s+/g, ".")}@gymbuddy.ai`,
      goal: "Build Muscle & Strength",
      experienceLevel: "Intermediate",
      weight: 75.0,
      targetWeight: 72.0,
      calorieTarget: 2400,
      proteinTarget: 160,
    };
    loginAsAthlete(customAthlete);
  });
});
