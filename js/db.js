/**
 * GYMBUDDY — ATHLETE DATA & PERSISTENCE ENGINE
 * 100% Client-Side Persistent Storage Engine.
 * Manages athlete profiles, workouts, form scans, meal logs, hydration, PRs, and community challenges.
 */

// Helper: current date string YYYY-MM-DD
export function getTodayDateString() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Local storage helper per user ID
function getLocalStore(uid, key, defaultValue) {
  try {
    const raw = localStorage.getItem(`gymbuddy_${uid}_${key}`) || localStorage.getItem(`formcoach_${uid}_${key}`);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocalStore(uid, key, value) {
  try {
    localStorage.setItem(`gymbuddy_${uid}_${key}`, JSON.stringify(value));
    localStorage.setItem(`formcoach_${uid}_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage quota or error:", e);
  }
}

// 1. USER PROFILE
export async function getUserProfile(uid, fallbackUser = {}) {
  const defaultProfile = {
    uid,
    displayName: fallbackUser.displayName || fallbackUser.name || "Athlete",
    email: fallbackUser.email || "athlete@gymbuddy.ai",
    photoURL: fallbackUser.photoURL || null,
    fitnessGoal: "Build Muscle & Strength",
    experienceLevel: "Intermediate",
    weight: 75,
    height: 178,
    age: 25,
    gender: "Not Specified",
    targetCalories: 2400,
    targetProtein: 160,
    targetCarbs: 260,
    targetFats: 65,
    waterGoalMl: 3000,
    unitSystem: "metric",
    streakDays: 0,
    totalWorkouts: 0,
    totalCaloriesBurned: 0,
    formAccuracyAvg: 0,
    xpPoints: 0,
    tier: "Rookie Athlete",
    createdAt: new Date().toISOString(),
    ...getLocalStore(uid, "profile", {})
  };

  setLocalStore(uid, "profile", defaultProfile);
  return defaultProfile;
}

export async function saveUserProfile(uid, updates) {
  const current = await getUserProfile(uid);
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
  setLocalStore(uid, "profile", merged);
  return merged;
}

// 2. DASHBOARD STATS
export async function getDashboardData(uid) {
  const profile = await getUserProfile(uid);
  const workouts = await getWorkouts(uid);
  const formScans = await getFormAnalyses(uid);
  const todayMeals = await getMeals(uid, getTodayDateString());
  const waterMl = await getWaterIntake(uid, getTodayDateString());

  // Today's calories & macros
  const totalCals = todayMeals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);
  const totalProtein = todayMeals.reduce((acc, m) => acc + (Number(m.protein) || 0), 0);
  const totalCarbs = todayMeals.reduce((acc, m) => acc + (Number(m.carbs || m.carbohydrates) || 0), 0);
  const totalFats = todayMeals.reduce((acc, m) => acc + (Number(m.fat || m.fats) || 0), 0);

  // Form accuracy average calculation
  let avgForm = 0;
  if (formScans.length > 0) {
    const sum = formScans.reduce((acc, s) => acc + (Number(s.score || s.overallScore) || 0), 0);
    avgForm = Math.round(sum / formScans.length);
  }

  // Workouts count
  const totalWorkoutsCount = workouts.length > 0 ? workouts.length : (profile.totalWorkouts || 0);
  const totalCalsBurned = workouts.reduce((acc, w) => acc + (Number(w.caloriesBurned) || 350), 0) || profile.totalCaloriesBurned || 0;

  // Streak calculation
  let streak = profile.streakDays || 0;
  if (workouts.length > 0 && streak === 0) {
    streak = 1;
  }

  return {
    profile,
    streakDays: streak,
    totalWorkouts: totalWorkoutsCount,
    totalCaloriesBurned: totalCalsBurned,
    formAccuracyAvg: avgForm,
    scansCount: formScans.length,
    todayNutrition: {
      calories: totalCals,
      protein: totalProtein,
      carbs: totalCarbs,
      fats: totalFats,
      targetCalories: profile.targetCalories || 2400,
      targetProtein: profile.targetProtein || 160,
      targetCarbs: profile.targetCarbs || 260,
      targetFats: profile.targetFats || 65,
      waterMl,
      waterGoalMl: profile.waterGoalMl || 3000
    },
    recentWorkouts: workouts.slice(0, 5),
    recentScans: formScans.slice(0, 5)
  };
}

// 3. WORKOUTS
export async function getWorkouts(uid) {
  const local = getLocalStore(uid, "workouts", null);
  if (local !== null) return local;

  setLocalStore(uid, "workouts", []);
  return [];
}

export async function logWorkout(uid, workoutData) {
  const current = await getWorkouts(uid);
  const newWorkout = {
    id: "w-" + Date.now(),
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    timestamp: Date.now(),
    completed: true,
    caloriesBurned: workoutData.caloriesBurned || 400,
    ...workoutData
  };

  const updated = [newWorkout, ...current];
  setLocalStore(uid, "workouts", updated);

  // Update profile stats
  const profile = await getUserProfile(uid);
  const nextWorkouts = (profile.totalWorkouts || 0) + 1;
  const nextCalories = (profile.totalCaloriesBurned || 0) + (newWorkout.caloriesBurned || 400);
  const nextStreak = (profile.streakDays || 0) + 1;
  const nextXp = (profile.xpPoints || 0) + 100;

  let nextTier = "Rookie Athlete";
  if (nextXp >= 1500) nextTier = "Elite Athlete";
  else if (nextXp >= 800) nextTier = "Pro Athlete";
  else if (nextXp >= 300) nextTier = "Dedicated Lifter";

  await saveUserProfile(uid, {
    totalWorkouts: nextWorkouts,
    totalCaloriesBurned: nextCalories,
    streakDays: nextStreak,
    xpPoints: nextXp,
    tier: nextTier
  });

  return newWorkout;
}

// 4. FORM ANALYZER SCANS
export async function getFormAnalyses(uid) {
  const local = getLocalStore(uid, "form_scans", null);
  if (local !== null) return local;

  setLocalStore(uid, "form_scans", []);
  return [];
}

export async function saveFormAnalysis(uid, analysis) {
  const current = await getFormAnalyses(uid);
  const now = new Date();
  const dateLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  
  const scoreVal = Number(analysis.overallScore || analysis.score) || 90;
  const newScan = {
    id: "scan-" + Date.now(),
    exercise: analysis.exercise || "Barbell Squat",
    overallScore: scoreVal,
    score: scoreVal,
    grade: analysis.grade || (scoreVal >= 90 ? "A" : scoreVal >= 80 ? "B" : "C"),
    postureStatus: analysis.postureStatus || analysis.summary || "Completed Kinematic Scan",
    metrics: analysis.metrics || analysis.jointAngles || {},
    jointAngles: analysis.jointAngles || analysis.metrics || {},
    strengths: analysis.strengths || [],
    issues: analysis.issues || analysis.corrections || [],
    corrections: analysis.corrections || analysis.issues || [],
    recommendations: analysis.recommendations || analysis.recommendedNextRep || "",
    summary: analysis.summary || "",
    mediaType: analysis.mediaType || "Photo",
    mediaUrl: analysis.mediaUrl || null,
    date: dateLabel,
    createdAt: Date.now(),
    timestamp: Date.now()
  };

  const updated = [newScan, ...current];
  setLocalStore(uid, "form_scans", updated);

  // Recalculate average form score in profile
  const profile = await getUserProfile(uid);
  const avg = Math.round(updated.reduce((a, c) => a + (Number(c.score || c.overallScore) || 0), 0) / updated.length);
  await saveUserProfile(uid, {
    formAccuracyAvg: avg,
    xpPoints: (profile.xpPoints || 0) + 50
  });

  return newScan;
}

// 5. NUTRITION MEALS & WATER
export async function getMeals(uid, dateStr = getTodayDateString()) {
  const local = getLocalStore(uid, "meals", null);
  if (local !== null) {
    return local.filter(m => !dateStr || m.date === dateStr || !m.date);
  }

  setLocalStore(uid, "meals", []);
  return [];
}

export async function getNutritionMeals(uid) {
  return getMeals(uid, getTodayDateString());
}

export async function logMeal(uid, mealData) {
  const defaultDate = getTodayDateString();
  const allMeals = getLocalStore(uid, "meals", []);
  const now = new Date();
  
  const newMeal = {
    id: "meal-" + Date.now(),
    mealName: mealData.mealName || mealData.name || mealData.description || "Logged Meal",
    name: mealData.mealName || mealData.name || mealData.description || "Logged Meal",
    category: mealData.category || mealData.mealType || "Lunch",
    mealType: mealData.mealType || mealData.category || "Lunch",
    detectedFoods: mealData.detectedFoods || mealData.foods || [mealData.mealName || "Meal"],
    foods: mealData.detectedFoods || mealData.foods || [mealData.mealName || "Meal"],
    calories: Number(mealData.calories) || 0,
    protein: Number(mealData.protein) || 0,
    carbs: Number(mealData.carbs || mealData.carbohydrates) || 0,
    carbohydrates: Number(mealData.carbs || mealData.carbohydrates) || 0,
    fat: Number(mealData.fat || mealData.fats) || 0,
    fats: Number(mealData.fat || mealData.fats) || 0,
    fiber: Number(mealData.fiber) || 0,
    qualityScore: Number(mealData.qualityScore || mealData.healthScore) || 8,
    healthScore: Number(mealData.healthScore || mealData.qualityScore) || 8,
    aiInsight: mealData.aiInsight || mealData.advice || mealData.recommendations || "Balanced macro split.",
    recommendations: mealData.aiInsight || mealData.advice || mealData.recommendations || "Balanced macro split.",
    imageUrl: mealData.imageUrl || mealData.image || null,
    date: mealData.date || defaultDate,
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: Date.now(),
    timestamp: Date.now()
  };

  const updated = [newMeal, ...allMeals];
  setLocalStore(uid, "meals", updated);

  // Update profile XP
  const profile = await getUserProfile(uid);
  await saveUserProfile(uid, {
    xpPoints: (profile.xpPoints || 0) + 30
  });

  return newMeal;
}

export async function logNutritionMeal(uid, mealData) {
  await logMeal(uid, mealData);
  return getNutritionMeals(uid);
}

export async function deleteMeal(uid, mealId) {
  const allMeals = getLocalStore(uid, "meals", []);
  const filtered = allMeals.filter(m => m.id !== mealId);
  setLocalStore(uid, "meals", filtered);
  return filtered;
}

export async function getWaterIntake(uid, dateStr = getTodayDateString()) {
  const waterMap = getLocalStore(uid, "water_logs", {});
  return waterMap[dateStr] !== undefined ? waterMap[dateStr] : 0;
}

export async function updateWaterIntake(uid, deltaMl, dateStr = getTodayDateString()) {
  const waterMap = getLocalStore(uid, "water_logs", {});
  const current = waterMap[dateStr] || 0;
  const nextVal = deltaMl === 0 ? 0 : Math.max(0, current + deltaMl);
  waterMap[dateStr] = nextVal;
  setLocalStore(uid, "water_logs", waterMap);
  return nextVal;
}

// 6. PROGRESS & PERSONAL RECORDS
export async function getProgressData(uid) {
  const defaultProgress = {
    weightHistory: [],
    personalRecords: [],
    volumeHistory: []
  };

  return getLocalStore(uid, "progress_data", defaultProgress);
}

export async function logWeightEntry(uid, weight) {
  const current = await getProgressData(uid);
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const updatedHistory = [...(current.weightHistory || []), { date: todayLabel, weight: Number(weight) }];
  const updated = { ...current, weightHistory: updatedHistory };
  setLocalStore(uid, "progress_data", updated);

  await saveUserProfile(uid, { weight: Number(weight) });
  return updated;
}

export async function savePersonalRecord(uid, record) {
  const current = await getProgressData(uid);
  const existingRecords = current.personalRecords || [];
  const existingIndex = existingRecords.findIndex(r => r.exercise.toLowerCase() === record.exercise.toLowerCase());
  let newPrs = [...existingRecords];

  const prEntry = {
    exercise: record.exercise,
    weightKg: Number(record.weightKg),
    reps: Number(record.reps || 1),
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    formScore: record.formScore || 90
  };

  if (existingIndex >= 0) {
    newPrs[existingIndex] = prEntry;
  } else {
    newPrs.push(prEntry);
  }

  const updated = { ...current, personalRecords: newPrs };
  setLocalStore(uid, "progress_data", updated);
  return updated;
}

// 7. COMMUNITY CHALLENGES & LEADERBOARD
export async function getChallengesData(uid) {
  const defaultChallenges = [
    {
      id: "c-1",
      title: "30-Day Form Perfection Sprint",
      category: "Biomechanics",
      participantsCount: 1420,
      rewardXp: 500,
      daysLeft: 16,
      progressPct: 0,
      joined: false,
      description: "Perform 1 scan per workout session and maintain form accuracy above 90%."
    },
    {
      id: "c-2",
      title: "100,000 kg Volume Month",
      category: "Strength Volume",
      participantsCount: 890,
      rewardXp: 750,
      daysLeft: 22,
      progressPct: 0,
      joined: false,
      description: "Accumulate 100 metric tons of verified total training tonnage."
    },
    {
      id: "c-3",
      title: "14-Day Zero Sugar Clean Cut",
      category: "Nutrition",
      participantsCount: 2310,
      rewardXp: 400,
      daysLeft: 8,
      progressPct: 0,
      joined: false,
      description: "Log all meals and stay within target carbohydrate bounds daily."
    },
    {
      id: "c-4",
      title: "Squat Depth & Hip Symmetry",
      category: "Kinematics",
      participantsCount: 650,
      rewardXp: 600,
      daysLeft: 28,
      progressPct: 0,
      joined: false,
      description: "Score 90%+ on 10 consecutive squat analyses with zero knee caving."
    }
  ];

  const defaultLeaderboard = [
    { rank: 1, name: "Marcus Vance", badge: "Master Lifter", xp: 4890, formAvg: 96, avatar: "M" },
    { rank: 2, name: "Elena Rostova", badge: "Biomechanics Pro", xp: 4620, formAvg: 95, avatar: "E" },
    { rank: 3, name: "David Chen", badge: "Iron Veteran", xp: 4310, formAvg: 94, avatar: "D" },
    { rank: 4, name: "Sarah Miller", badge: "Hypertrophy Elite", xp: 3980, formAvg: 93, avatar: "S" },
    { rank: 5, name: "Liam O'Connor", badge: "Strength Coach", xp: 1380, formAvg: 90, avatar: "L" },
    { rank: 6, name: "Athlete (You)", badge: "Rookie Athlete", xp: 0, formAvg: 0, avatar: "A", isCurrent: true }
  ];

  const profile = await getUserProfile(uid);
  const challenges = getLocalStore(uid, "challenges", defaultChallenges);
  const leaderboard = defaultLeaderboard.map(u => {
    if (u.isCurrent) {
      return {
        ...u,
        name: `${profile.displayName || "Athlete"} (You)`,
        xp: profile.xpPoints || 0,
        formAvg: profile.formAccuracyAvg || 0,
        badge: profile.tier || "Rookie Athlete"
      };
    }
    return u;
  });

  return { challenges, leaderboard };
}

export async function toggleJoinChallenge(uid, challengeId) {
  const { challenges } = await getChallengesData(uid);
  const updated = challenges.map(c => {
    if (c.id === challengeId) {
      const nextJoined = !c.joined;
      return {
        ...c,
        joined: nextJoined,
        progressPct: nextJoined ? 10 : 0
      };
    }
    return c;
  });

  setLocalStore(uid, "challenges", updated);
  return updated;
}

// 8. AI COACH CHAT HISTORY
export async function getCoachChatHistory(uid) {
  const defaultHistory = [
    {
      id: "msg-1",
      sender: "coach",
      text: "Hello! I am your **GymBuddy AI Specialist**. I can analyze your exercise mechanics, adjust your volume split, design optimal warmups, or build custom high-protein meal plans. How can I help with your training today?",
      timestamp: Date.now() - 100000
    }
  ];

  return getLocalStore(uid, "coach_chat", defaultHistory);
}

export async function saveCoachMessage(uid, sender, text) {
  const current = await getCoachChatHistory(uid);
  const newMsg = {
    id: "msg-" + Date.now(),
    sender,
    text,
    timestamp: Date.now()
  };
  const updated = [...current, newMsg];
  setLocalStore(uid, "coach_chat", updated);
  return updated;
}

export async function clearCoachChatHistory(uid) {
  const cleared = [
    {
      id: "msg-" + Date.now(),
      sender: "coach",
      text: "Chat history cleared. How can I assist you with your fitness goals today?",
      timestamp: Date.now()
    }
  ];
  setLocalStore(uid, "coach_chat", cleared);
  return cleared;
}
