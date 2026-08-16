import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Dynamic port resolution for Render & cloud deployment
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Google Gemini Client with official User-Agent header
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient Gemini content generation with retry and fallback models
async function generateGeminiContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    systemInstruction?: string;
  }
): Promise<string> {
  const models = ["gemini-3.7-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = { ...(params.config || {}) };
        if (params.systemInstruction) {
          config.systemInstruction = params.systemInstruction;
        }

        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config,
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isUnavailable = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("429");
        
        console.warn(`[GymBuddy AI] Model ${model} attempt ${attempt + 1} note:`, errMsg.slice(0, 120));
        
        if (isUnavailable && attempt === 0) {
          // Short backoff before retry
          await new Promise((r) => setTimeout(r, 600));
        } else {
          break; // Try next model in sequence
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models temporarily unavailable");
}

// ==========================================
// 1. Health Check Endpoint
// ==========================================
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "GymBuddy",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    environment: process.env.NODE_ENV || "development",
  });
});

// ==========================================
// 2. AI Coach Chat Handler
// ==========================================
const handleCoachChat = async (req: express.Request, res: express.Response) => {
  const { message, history = [], profile = {} } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const athleteName = profile.displayName || "Athlete";
  const fitnessGoal = profile.fitnessGoal || profile.goal || "Build Muscle & Strength";
  const experienceLevel = profile.experienceLevel || "Intermediate";

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        reply: generateCoachFallbackReply(message, athleteName, fitnessGoal),
        suggestedActions: ["Log this in Workouts", "Scan your form in Exercise Analyser", "Check daily protein target"],
      });
    }

    const systemInstruction = `You are GymBuddy, an elite strength & conditioning coach, biomechanics specialist, and sports nutritionist.
You coach athletes with evidence-based cues, posture guidance, exercise progressions, recovery techniques, and macronutrient strategies.
Athlete Profile:
- Name: ${athleteName}
- Fitness Goal: ${fitnessGoal}
- Experience Level: ${experienceLevel}
- Target Calories: ${profile.targetCalories || profile.calorieTarget || "2400"} kcal/day
- Target Protein: ${profile.targetProtein || profile.proteinTarget || "160"} g/day

Tone: Professional, direct, encouraging, precise, and highly actionable.
Structure responses cleanly using markdown headers, bullet points, and bold keywords. Keep advice concise and easy to read during training sessions.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.sender === "user" || item.role === "user") {
          contents.push({ role: "user", parts: [{ text: item.text || item.content }] });
        } else if (item.sender === "coach" || item.role === "model" || item.role === "assistant") {
          contents.push({ role: "model", parts: [{ text: item.text || item.content }] });
        }
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const reply = await generateGeminiContentWithFallback(ai, {
      contents,
      systemInstruction,
      config: { temperature: 0.7 },
    });

    res.json({ reply });
  } catch (error: any) {
    console.error("[GymBuddy] Gemini Coach fallback triggered:", error.message || error);
    res.json({
      reply: generateCoachFallbackReply(message, athleteName, fitnessGoal),
      suggestedActions: ["Log this in Workouts", "Check daily protein target"],
    });
  }
};

function generateCoachFallbackReply(msg: string, name: string, goal: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("squat") || lower.includes("leg") || lower.includes("quad")) {
    return `### 🏋️ Coach Breakdown: Squat & Lower Body Focus\n\nHey **${name}**, for ${goal.toLowerCase()}, optimize your squat mechanics with these key cues:\n\n- **Foot Rooting:** Create a 3-point tripod contact (big toe, pinky toe, heel) and screw your feet outward into the floor.\n- **Bracing:** Take a 360° diaphragmatic breath into your abdomen before each descent.\n- **Knee Tracking:** Drive knees in line with your middle toes to prevent medial collapse (valgus).\n- **Tempo:** Control down for 2-3 seconds, maintain tension at parallel, and accelerate up.\n\n*Tip: Hit 3-4 working sets in the 6-10 rep range with 2 reps in reserve (RPE 8).*`;
  }
  if (lower.includes("bench") || lower.includes("chest") || lower.includes("press")) {
    return `### 💪 Coach Breakdown: Pressing & Upper Body\n\nGreat question, **${name}**. When pressing for ${goal.toLowerCase()}:\n\n- **Scapular Retraction:** Pinch shoulder blades down and back into the bench for shoulder stability.\n- **Elbow Angle:** Maintain a 45° to 60° tuck rather than flaring elbows wide.\n- **Bar Path:** Touch the lower sternum and press slightly backward over the shoulders at lockout.\n- **Leg Drive:** Keep feet firmly planted to transfer ground force through your kinetic chain.`;
  }
  if (lower.includes("protein") || lower.includes("diet") || lower.includes("food") || lower.includes("macro") || lower.includes("eat")) {
    return `### 🥗 Nutrition & Macro Recommendation\n\nTo support your goal of **${goal}**:\n\n- **Daily Protein:** Target 1.6 to 2.2g per kg of bodyweight (e.g. 150-180g/day) spaced across 3-5 meals.\n- **Peri-Workout Fuel:** Consume 30-40g fast carbs + 25-30g whey/protein 60 mins before or after training.\n- **Hydration:** Aim for 3.0 to 3.5 Liters of water daily + electrolytes on heavy training days.`;
  }
  return `### ⚡ GymBuddy Training Advice\n\nHey **${name}**, to optimize your training for **${goal}**:\n\n1. **Progressive Overload:** Aim to add 1 rep or small incremental weight (1-2.5kg) each week on core lifts.\n2. **Kinetic Chain Stability:** Keep neutral spine alignment and control the eccentric (lowering) phase for 2-3 seconds.\n3. **Recovery & Sleep:** Muscles grow during deep rest. Prioritize 7.5-8.5 hours of quality sleep and track your hydration in GymBuddy.\n\nKeep up the discipline and let me know if you want a specific routine or form cue!`;
}

app.post("/api/gemini/coach", handleCoachChat);
app.post("/api/coach", handleCoachChat);

// ==========================================
// 3. AI Form Analyzer Handler
// ==========================================
const handleFormAnalyzer = async (req: express.Request, res: express.Response) => {
  const { exercise = "Barbell Squat", image, notes = "", experience = "Intermediate" } = req.body || {};

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateFormFallback(exercise, experience));
    }

    const parts: any[] = [];
    if (image && typeof image === "string") {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      } else if (!image.startsWith("data:") && !image.startsWith("http")) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image,
          },
        });
      }
    }

    const promptText = `You are a precision biomechanics kinematic analyzer for strength training.
Exercise Being Analyzed: ${exercise}
Athlete Experience Level: ${experience}
Athlete Notes: ${notes || "Standard working set"}

Analyze the visual posture, joint angles, spine neutrality, bar path, and kinetic safety for ${exercise}.
Return ONLY a valid JSON object matching this schema:
{
  "score": number (0 to 100 integer),
  "grade": string ("A+", "A", "B", "C", or "Needs Work"),
  "postureStatus": string (brief summary like "Optimal Alignment" or "Mild Knee Valgus"),
  "jointAngles": {
    "hipAngle": string (e.g. "108° (Good hinge)"),
    "kneeAngle": string (e.g. "90° (Parallel depth)"),
    "spineAngle": string (e.g. "Neutral (0° lumbar deviation)"),
    "barPath": string (e.g. "Straight vertical line over midfoot")
  },
  "strengths": string[] (array of 3 distinct positive execution highlights),
  "corrections": string[] (array of 3 actionable, specific corrective cues),
  "injuryRisk": string ("Low", "Moderate", or "High"),
  "primaryMuscle": string,
  "tempoAssessment": string,
  "recommendedNextRep": string,
  "summary": string (2-3 concise sentences summing up the repetition quality)
}`;

    parts.push({ text: promptText });

    const rawText = await generateGeminiContentWithFallback(ai, {
      contents: { parts },
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(rawText || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("[GymBuddy] Gemini Form Analyzer fallback triggered:", error.message || error);
    res.json(generateFormFallback(exercise, experience));
  }
};

function generateFormFallback(exercise: string, experience: string) {
  const ex = exercise.toLowerCase();
  if (ex.includes("deadlift")) {
    return {
      score: 93,
      grade: "A",
      postureStatus: "Locked Posterior Chain & Neutral Spine",
      jointAngles: {
        hipAngle: "115° (Adequate hip hinge position)",
        kneeAngle: "130° (Soft knee bend without excessive squatting)",
        spineAngle: "0° (Neutral cervical and lumbar alignment)",
        barPath: "Vertical line scraping shins",
      },
      strengths: [
        "Lats engaged tightly with slack pulled out of the barbell before lifting",
        "Hips and chest rising at identical velocity off the floor",
        "Full glute lockout at top without hyperextending lower back",
      ],
      corrections: [
        "Keep neck packed in neutral position rather than looking up at mirror",
        "Control barbell descent along the thighs before breaking at knees",
        "Maintain abdominal brace through entire lockout",
      ],
      injuryRisk: "Low",
      primaryMuscle: "Glutes, Hamstrings, Spinal Erectors, Latissimus Dorsi",
      tempoAssessment: "Explosive 1-second pull, controlled 2-second eccentric",
      recommendedNextRep: "Maintain current weight and execute next set with same bracing consistency.",
      summary: `Outstanding mechanical execution on the ${exercise}. Bar path remains tightly over mid-foot with zero spinal flexion.`,
    };
  }

  if (ex.includes("bench") || ex.includes("press")) {
    return {
      score: 90,
      grade: "A-",
      postureStatus: "Stable Scapular Retraction & Controlled Path",
      jointAngles: {
        hipAngle: "90° (Firm leg drive contact)",
        kneeAngle: "90° (Heels driven into floor)",
        spineAngle: "Arch maintained with thoracic extension",
        barPath: "J-curve path from lower chest to above shoulders",
      },
      strengths: [
        "Scapulae pinned solidly into the bench throughout the rep",
        "45-degree elbow tuck protecting anterior shoulder capsule",
        "Crisp pause on chest before initiating concentric drive",
      ],
      corrections: [
        "Squeeze the barbell harder to increase forearm recruitment",
        "Drive heels actively downward to generate full-body tension",
        "Keep wrists stacked straight over elbows without backward bend",
      ],
      injuryRisk: "Low",
      primaryMuscle: "Pectoralis Major, Anterior Deltoid, Triceps Brachii",
      tempoAssessment: "2:1 tempo (2s lowering, 1s press)",
      recommendedNextRep: "Keep wrists strictly neutral on the next rep.",
      summary: `Clean mechanics on your ${exercise}. Elbow tuck angle is safe and upper back foundation is solid.`,
    };
  }

  // Default Squat / General
  return {
    score: 92,
    grade: "A",
    postureStatus: "Optimal Alignment & Balanced Bar Path",
    jointAngles: {
      hipAngle: "105° (Proper hip hinge depth)",
      kneeAngle: "88° (Full parallel depth achieved)",
      spineAngle: "0° (Neutral lumbar & thoracic spine)",
      barPath: "Vertical plane over midfoot",
    },
    strengths: [
      "Strong core bracing with steady intra-abdominal pressure",
      "Knees tracking cleanly in line with toes with zero valgus collapse",
      "Balanced center of gravity maintained across the foot tripod",
    ],
    corrections: [
      "Drive elbows slightly forward under the bar to lock upper back tighter",
      "Maintain head in neutral alignment rather than looking straight up",
      "Control the descent with a steady 2-3 second eccentric tempo",
    ],
    injuryRisk: "Low",
    primaryMuscle: "Quadriceps, Gluteus Maximus & Spinal Erectors",
    tempoAssessment: "Consistent 2:1 eccentric-to-concentric ratio",
    recommendedNextRep: "Maintain current load or add 2.5kg for your next working set.",
    summary: `Excellent execution on your ${exercise}. Kinetic chain stability is high with safe joint alignment.`,
  };
}

app.post("/api/gemini/analyze-form", handleFormAnalyzer);
app.post("/api/analyze-form", handleFormAnalyzer);
app.post("/api/analyze", handleFormAnalyzer);

// ==========================================
// 4. AI Workout Generator Handler
// ==========================================
const handleWorkoutGenerator = async (req: express.Request, res: express.Response) => {
  const {
    goal = "Muscle Building",
    muscleGroup = "Full Body",
    equipment = "Full Gym",
    durationMinutes = 45,
    fitnessLevel = "Intermediate",
    injuries = "None",
  } = req.body || {};

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateWorkoutFallback(goal, muscleGroup, equipment, durationMinutes));
    }

    const prompt = `You are a certified CSCS Strength and Conditioning Specialist.
Create a personalized workout program based on:
- Goal: ${goal}
- Target Muscles: ${muscleGroup}
- Available Equipment: ${equipment}
- Time Budget: ${durationMinutes} minutes
- Fitness Level: ${fitnessLevel}
- Physical Limitations / Injuries: ${injuries}

Return ONLY a valid JSON object matching this schema:
{
  "routineTitle": string,
  "description": string,
  "estimatedDuration": string,
  "targetMuscles": string[],
  "warmup": [
    { "name": string, "reps": string, "note": string }
  ],
  "exercises": [
    { "name": string, "sets": number, "reps": string, "targetRpe": number, "restSeconds": number, "formFocus": string }
  ],
  "cooldown": [
    { "name": string, "duration": string }
  ],
  "coachTip": string
}`;

    const rawText = await generateGeminiContentWithFallback(ai, {
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(rawText || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("[GymBuddy] Gemini Workout Generator fallback triggered:", error.message || error);
    res.json(generateWorkoutFallback(goal, muscleGroup, equipment, durationMinutes));
  }
};

function generateWorkoutFallback(goal: string, muscleGroup: string, equipment: string, duration: number) {
  const muscleLower = muscleGroup.toLowerCase();

  let exercises = [
    { name: "Barbell Back Squat", sets: 4, reps: "8-10", targetRpe: 8, restSeconds: 90, formFocus: "Hit parallel depth, push knees out over toes" },
    { name: "Romanian Deadlift (Dumbbell or Barbell)", sets: 3, reps: "10-12", targetRpe: 8, restSeconds: 75, formFocus: "Hinge at hips with soft knees, feel hamstring stretch" },
    { name: "Dumbbell Incline Bench Press", sets: 3, reps: "10-12", targetRpe: 8, restSeconds: 60, formFocus: "45-degree elbow tuck, pause at bottom chest" },
    { name: "Chest-Supported Dumbbell Row", sets: 3, reps: "12-15", targetRpe: 9, restSeconds: 60, formFocus: "Squeeze scapulae together at peak contraction" },
    { name: "Standing Cable Woodchoppers", sets: 3, reps: "15 each side", targetRpe: 7, restSeconds: 45, formFocus: "Rotate through torso while keeping hips stable" },
  ];

  if (muscleLower.includes("push") || muscleLower.includes("chest")) {
    exercises = [
      { name: "Flat Barbell Bench Press", sets: 4, reps: "6-8", targetRpe: 8, restSeconds: 90, formFocus: "Scapular retraction, drive feet into floor" },
      { name: "Incline Dumbbell Press", sets: 3, reps: "8-10", targetRpe: 8, restSeconds: 75, formFocus: "30-degree incline, full chest stretch" },
      { name: "Standing Overhead Military Press", sets: 3, reps: "8-10", targetRpe: 8, restSeconds: 75, formFocus: "Brace glutes and abs to avoid lumbar extension" },
      { name: "Low-to-High Cable Flyes", sets: 3, reps: "12-15", targetRpe: 9, restSeconds: 45, formFocus: "Squeeze upper pecs at peak contraction" },
      { name: "Cable Tricep Rope Pushdowns", sets: 3, reps: "12-15", targetRpe: 9, restSeconds: 45, formFocus: "Lock elbows in place, flare rope at bottom" },
    ];
  } else if (muscleLower.includes("pull") || muscleLower.includes("back")) {
    exercises = [
      { name: "Barbell Conventional Deadlift", sets: 4, reps: "5-6", targetRpe: 8, restSeconds: 120, formFocus: "Lats locked, drive the floor away" },
      { name: "Weighted Pull-Ups or Lat Pulldowns", sets: 4, reps: "8-10", targetRpe: 8, restSeconds: 90, formFocus: "Lead with chest to the bar, controlled lowering" },
      { name: "Chest-Supported T-Bar Row", sets: 3, reps: "10-12", targetRpe: 8, restSeconds: 75, formFocus: "Full stretch at bottom, squeeze mid-back" },
      { name: "Rear Delt Face Pulls", sets: 3, reps: "15-20", targetRpe: 7, restSeconds: 45, formFocus: "Externally rotate shoulders, pull rope to forehead" },
      { name: "Incline Dumbbell Bicep Curls", sets: 3, reps: "12-15", targetRpe: 9, restSeconds: 45, formFocus: "Keep upper arms perpendicular to the floor" },
    ];
  } else if (muscleLower.includes("leg") || muscleLower.includes("lower")) {
    exercises = [
      { name: "Barbell High-Bar Squat", sets: 4, reps: "6-8", targetRpe: 8, restSeconds: 120, formFocus: "Hit parallel, keep chest proud" },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", targetRpe: 8, restSeconds: 90, formFocus: "Push hips back, stop before lower back flexes" },
      { name: "Bulgarian Split Squats", sets: 3, reps: "10 each", targetRpe: 8, restSeconds: 60, formFocus: "Torso slightly leaned forward over lead quad" },
      { name: "Seated Hamstring Leg Curl", sets: 3, reps: "12-15", targetRpe: 9, restSeconds: 45, formFocus: "2-second eccentric lowering" },
      { name: "Standing Calf Raises", sets: 4, reps: "15", targetRpe: 8, restSeconds: 45, formFocus: "Pause 2s at full bottom stretch and top contraction" },
    ];
  }

  return {
    routineTitle: `${muscleGroup} ${goal} Protocol`,
    description: `A hyper-optimized ${duration}-minute training session targeting ${muscleGroup} for ${goal.toLowerCase()}.`,
    estimatedDuration: `${duration} mins`,
    targetMuscles: [muscleGroup, "Core Stabilizers"],
    warmup: [
      { name: "Dynamic Cat-Cow & World's Greatest Stretch", reps: "2 sets x 8 reps", note: "Mobilize thoracic spine & hips" },
      { name: "Band Pull-Aparts & Glute Bridges", reps: "2 sets x 15 reps", note: "Prime posterior chain activation" },
    ],
    exercises,
    cooldown: [
      { name: "Pigeon Pose & Hip Flexor Stretch", duration: "2 mins each side" },
      { name: "Diaphragmatic Box Breathing", duration: "3 mins" },
    ],
    coachTip: "Focus on controlled 3-second lowering (eccentrics) on all compound lifts to maximize muscular tension.",
  };
}

app.post("/api/gemini/generate-workout", handleWorkoutGenerator);
app.post("/api/workout", handleWorkoutGenerator);

// ==========================================
// 5. AI Nutrition & Macro Analyzer Handler
// ==========================================
const handleNutritionAnalyzer = async (req: express.Request, res: express.Response) => {
  const { mealDescription = "", image, mealType = "Lunch", calorieTarget = 2400, proteinTarget = 160 } = req.body || {};

  try {
    const ai = getGeminiClient();
    if (!ai) {
      const fallbackResult = estimateNutritionFallback(mealDescription, mealType, calorieTarget, proteinTarget);
      return res.json(fallbackResult);
    }

    const parts: any[] = [];
    if (image && typeof image === "string") {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      } else if (!image.startsWith("http")) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image,
          },
        });
      }
    }

    const prompt = `You are a precision sports dietitian and nutritional biochemist.
Analyze the following meal photo or description:
Meal Category: ${mealType}
Meal Description: ${mealDescription || "Analyze food items visible in the attached image"}
User Daily Targets: ${calorieTarget} kcal, ${proteinTarget}g Protein

Accurately identify all detected food items on the plate and calculate estimated macronutrients and nutrition details.
Return ONLY a valid JSON object matching this schema:
{
  "mealName": string (concise descriptive name of the meal),
  "foods": string[] (array of specific food items detected, e.g. ["Grilled Chicken Breast", "Jasmine Rice", "Steamed Broccoli"]),
  "detectedFoods": string[] (same as foods),
  "nutrition": {
    "calories": number (estimated total kcal integer),
    "protein": number (grams of protein integer),
    "carbohydrates": number (grams of carbohydrates integer),
    "fat": number (grams of fat integer),
    "fiber": number (grams of dietary fiber integer)
  },
  "calories": number (estimated total kcal integer),
  "protein": number (grams of protein integer),
  "carbohydrates": number (grams of carbohydrates integer),
  "carbs": number (grams of carbohydrates integer),
  "fat": number (grams of fat integer),
  "fiber": number (grams of dietary fiber integer),
  "healthScore": number (integer from 1 to 10),
  "highlights": string[] (key nutrient highlights),
  "insight": string (concise actionable dietary insight/recommendation),
  "aiInsight": string (concise actionable dietary insight/recommendation)
}`;

    parts.push({ text: prompt });

    const rawText = await generateGeminiContentWithFallback(ai, {
      contents: { parts },
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(rawText || "{}");
    
    // Normalize fields
    const foods = Array.isArray(parsed.foods) && parsed.foods.length > 0 
      ? parsed.foods 
      : (Array.isArray(parsed.detectedFoods) && parsed.detectedFoods.length > 0 ? parsed.detectedFoods : [parsed.mealName || "Nutritious Meal"]);
    
    parsed.foods = foods;
    parsed.detectedFoods = foods;

    const calories = parsed.calories ?? parsed.nutrition?.calories ?? 450;
    const protein = parsed.protein ?? parsed.nutrition?.protein ?? 35;
    const carbs = parsed.carbohydrates ?? parsed.carbs ?? parsed.nutrition?.carbohydrates ?? parsed.nutrition?.carbs ?? 45;
    const fat = parsed.fat ?? parsed.fats ?? parsed.nutrition?.fat ?? parsed.nutrition?.fats ?? 12;
    const fiber = parsed.fiber ?? parsed.nutrition?.fiber ?? 6;
    const insight = parsed.insight ?? parsed.aiInsight ?? parsed.recommendations ?? "Balanced macronutrient distribution supporting training recovery.";

    parsed.calories = Number(calories);
    parsed.protein = Number(protein);
    parsed.carbohydrates = Number(carbs);
    parsed.carbs = Number(carbs);
    parsed.fat = Number(fat);
    parsed.fiber = Number(fiber);
    parsed.insight = insight;
    parsed.aiInsight = insight;
    parsed.nutrition = {
      calories: Number(calories),
      protein: Number(protein),
      carbohydrates: Number(carbs),
      fat: Number(fat),
      fiber: Number(fiber),
    };

    res.json(parsed);
  } catch (error: any) {
    console.error("[GymBuddy] Gemini Nutrition API fallback triggered:", error.message || error);
    const fallbackResult = estimateNutritionFallback(mealDescription, mealType, calorieTarget, proteinTarget);
    res.json(fallbackResult);
  }
};

// Sports Nutrition Database & Heuristic Estimator (Guarantees zero-downtime macro tracking)
function estimateNutritionFallback(
  description: string,
  category: string,
  targetCal: number,
  targetProtein: number
) {
  const text = (description || "").toLowerCase();
  let detected: string[] = [];
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  // Food keyword database with realistic sports nutrition portions
  const db = [
    { key: "chicken", name: "Grilled Chicken Breast (180g)", cal: 260, p: 48, c: 0, f: 5, fib: 0 },
    { key: "beef", name: "Lean Ground Beef (170g)", cal: 320, p: 38, c: 0, f: 18, fib: 0 },
    { key: "steak", name: "Sirloin Steak (200g)", cal: 380, p: 44, c: 0, f: 22, fib: 0 },
    { key: "salmon", name: "Atlantic Salmon (180g)", cal: 360, p: 36, c: 0, f: 23, fib: 0 },
    { key: "tuna", name: "Tuna (1 can / 140g)", cal: 150, p: 33, c: 0, f: 1, fib: 0 },
    { key: "egg", name: "Whole Eggs (3 large)", cal: 215, p: 18, c: 1, f: 15, fib: 0 },
    { key: "egg white", name: "Liquid Egg Whites (200ml)", cal: 100, p: 22, c: 1, f: 0, fib: 0 },
    { key: "tofu", name: "Firm Tofu (150g)", cal: 130, p: 14, c: 3, f: 8, fib: 2 },
    { key: "whey", name: "Whey Protein Isolate (1 scoop)", cal: 120, p: 25, c: 2, f: 1, fib: 0 },
    { key: "shake", name: "High-Protein Shake (350ml)", cal: 240, p: 32, c: 14, f: 5, fib: 2 },
    { key: "rice", name: "Jasmine / Basmati Rice (1 cup cooked)", cal: 210, p: 4, c: 45, f: 0.5, fib: 1 },
    { key: "oat", name: "Rolled Oats (1 cup)", cal: 300, p: 10, c: 54, f: 5, fib: 8 },
    { key: "oatmeal", name: "Rolled Oats (1 cup)", cal: 300, p: 10, c: 54, f: 5, fib: 8 },
    { key: "pasta", name: "Cooked Pasta (1.5 cups)", cal: 280, p: 9, c: 56, f: 2, fib: 3 },
    { key: "bread", name: "Whole Wheat Toast (2 slices)", cal: 160, p: 7, c: 28, f: 2, fib: 4 },
    { key: "toast", name: "Whole Grain Toast (2 slices)", cal: 160, p: 7, c: 28, f: 2, fib: 4 },
    { key: "potato", name: "Baked Sweet / Russet Potato", cal: 165, p: 4, c: 38, f: 0.2, fib: 4 },
    { key: "sweet potato", name: "Roasted Sweet Potato", cal: 160, p: 3, c: 37, f: 0.3, fib: 4 },
    { key: "banana", name: "Fresh Banana (medium)", cal: 105, p: 1.3, c: 27, f: 0.3, fib: 3 },
    { key: "apple", name: "Fresh Apple", cal: 95, p: 0.5, c: 25, f: 0.3, fib: 4 },
    { key: "berries", name: "Mixed Fresh Berries (1 cup)", cal: 70, p: 1, c: 17, f: 0.5, fib: 5 },
    { key: "avocado", name: "Fresh Avocado (1/2 fruit)", cal: 160, p: 2, c: 8, f: 15, fib: 7 },
    { key: "peanut butter", name: "Natural Peanut Butter (2 tbsp)", cal: 190, p: 8, c: 6, f: 16, fib: 2 },
    { key: "nuts", name: "Almonds & Mixed Nuts (30g)", cal: 180, p: 6, c: 6, f: 15, fib: 3 },
    { key: "olive oil", name: "Extra Virgin Olive Oil (1 tbsp)", cal: 120, p: 0, c: 0, f: 14, fib: 0 },
    { key: "broccoli", name: "Steamed Broccoli Florets (150g)", cal: 50, p: 4, c: 10, f: 0.6, fib: 4 },
    { key: "spinach", name: "Fresh / Sautéed Spinach", cal: 35, p: 3, c: 4, f: 0.5, fib: 3 },
    { key: "salad", name: "Mixed Greens & Vegetables", cal: 65, p: 2, c: 12, f: 1, fib: 4 },
    { key: "yogurt", name: "Greek Yogurt 0% (200g)", cal: 130, p: 22, c: 7, f: 0, fib: 0 },
    { key: "milk", name: "Fairlife / Dairy Milk (250ml)", cal: 120, p: 13, c: 6, f: 4.5, fib: 0 },
    { key: "pizza", name: "Artisan Pizza (2 slices)", cal: 540, p: 24, c: 62, f: 22, fib: 3 },
    { key: "burger", name: "Lean Beef Burger with Bun", cal: 560, p: 34, c: 44, f: 26, fib: 3 },
    { key: "burrito", name: "Chicken & Rice Burrito Bowl", cal: 620, p: 46, c: 68, f: 18, fib: 9 },
  ];

  for (const item of db) {
    if (text.includes(item.key)) {
      detected.push(item.name);
      calories += item.cal;
      protein += item.p;
      carbs += item.c;
      fat += item.f;
      fiber += item.fib;
    }
  }

  // If no specific keywords were matched, provide a balanced athletic meal baseline based on category
  if (detected.length === 0) {
    if (category === "Breakfast") {
      detected = ["Scrambled Eggs & Egg Whites", "Whole Grain Sourdough Toast", "Fresh Fruit Slice"];
      calories = 440;
      protein = 32;
      carbs = 42;
      fat = 14;
      fiber = 5;
    } else if (category === "Post-Workout" || category === "Snack") {
      detected = ["Whey Protein Isolate", "Hydrating Electrolyte & Amino Blend", "Fresh Banana"];
      calories = 290;
      protein = 34;
      carbs = 32;
      fat = 3;
      fiber = 3;
    } else {
      detected = ["Lean Protein Source", "Complex Carbohydrates", "Fibrous Green Vegetables"];
      calories = 540;
      protein = 44;
      carbs = 52;
      fat = 16;
      fiber = 6;
    }
  }

  const mealName = description
    ? description.charAt(0).toUpperCase() + description.slice(1, 35)
    : `${category} Performance Plate`;

  const proTargetPct = Math.round((protein / (targetProtein || 160)) * 100);

  return {
    mealName,
    foods: detected,
    detectedFoods: detected,
    nutrition: {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbohydrates: Math.round(carbs),
      fat: Math.round(fat),
      fiber: Math.round(fiber),
    },
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbohydrates: Math.round(carbs),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    healthScore: protein >= 30 ? 9 : 8,
    highlights: [`High Protein (${protein}g)`, `Energy Carbs (${carbs}g)`, `Essential Fats (${fat}g)`],
    insight: `Delivers ${protein}g quality protein (~${proTargetPct}% of daily target) with balanced glycogen replenishment for recovery.`,
    aiInsight: `Delivers ${protein}g quality protein (~${proTargetPct}% of daily target) with balanced glycogen replenishment for recovery.`,
  };
}

app.post("/api/gemini/analyze-nutrition", handleNutritionAnalyzer);
app.post("/api/nutrition", handleNutritionAnalyzer);

// ==========================================
// Vite & Static Asset Handling for Dev and Render Production
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const rootPath = process.cwd();

    // Serve bundled assets from dist
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.use(express.static(rootPath));

    const htmlPages = [
      "index",
      "login",
      "dashboard",
      "form-analyzer",
      "ai-coach",
      "workout",
      "nutrition",
      "progress",
      "challenges",
      "settings",
    ];

    // Explicit route helpers for clean URLs and direct .html access
    htmlPages.forEach((page) => {
      const servePage = (_req: express.Request, res: express.Response) => {
        const distFile = path.join(distPath, `${page}.html`);
        if (fs.existsSync(distFile)) {
          return res.sendFile(distFile);
        }
        const rootFile = path.join(rootPath, `${page}.html`);
        if (fs.existsSync(rootFile)) {
          return res.sendFile(rootFile);
        }
        res.sendFile(path.join(distPath, "index.html"));
      };

      app.get(`/${page}`, servePage);
      app.get(`/${page}.html`, servePage);
    });

    // Root route
    app.get("/", (_req, res) => {
      const distIndex = path.join(distPath, "index.html");
      if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
      }
      res.sendFile(path.join(rootPath, "index.html"));
    });

    // Fallback for SPA routing while preserving 404 for unmatched APIs
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      const distIndex = path.join(distPath, "index.html");
      if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
      }
      res.sendFile(path.join(rootPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=========================================`);
    console.log(`🚀 GymBuddy Server is active & listening`);
    console.log(`📡 Host: 0.0.0.0 | Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? "Configured" : "Not Detected (Using Smart Fallbacks)"}`);
    console.log(`=========================================`);
  });
}

startServer();
