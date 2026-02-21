import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const YARNGPT_API_KEY = process.env.YARNGPT_API_KEY;
const BASE_DIR = path.join(__dirname, "../public/audio");

if (!YARNGPT_API_KEY) {
  console.error("❌ YARNGPT_API_KEY not found in environment variables");
  process.exit(1);
}

// Voice mapping for languages
const VOICE_MAP: Record<string, string> = {
  en: "Femi", // English → rich, reassuring
  yo: "Wura", // Yoruba → young, sweet
  ha: "Zainab", // Hausa → soothing, gentle
  pcm: "Jude", // Nigerian Pidgin → warm, confident
  ig: "Chinonye", // Igbo → engaging, warm
  fr: "Idera", // French → melodic, gentle
};

// All texts to generate
const AUDIO_TEXTS = {
  onboarding: {
    en: {
      "question-1-name": "What is your name?",
      "question-2-age": "How old are you?",
      "question-3-sex": "What is your biological sex? Male, female, or other?",
      "question-4-hypertension": "Have you ever been diagnosed with high blood pressure?",
      "question-5-medications": "Are you taking any regular medications?",
      "question-6-smoke-drink": "Do you smoke or drink alcohol?",
      "question-7-activity": "What is your activity level? Low, moderate, or high?",
      "question-8-sleep": "How many hours do you sleep on average?",
      "question-9-family-history": "Is there a family history of heart disease?",
    },
    yo: {
      "question-1-name": "Kini orukọ rẹ?",
      "question-2-age": "Ọmọ ọdún mélòó ni o?",
      "question-3-sex": "Kini ẹ̀yà ara rẹ? Okunrin, obinrin, tàbí miiran?",
      "question-4-hypertension": "Ṣe o ti jẹ́ wípé o ní àrùn ẹ̀jẹ̀ tó ga?",
      "question-5-medications": "Ṣe o ń mu oògùn tó wàpọ̀?",
      "question-6-smoke-drink": "Ṣe o ń mu sìgá tàbí oti?",
      "question-7-activity": "Bí o ṣe ń ṣe iṣẹ́ ara ni kékéré, ààrín, tàbí púpọ̀?",
      "question-8-sleep": "Àwọn wákàtí mélòó ni o ń sùn lójoojúmọ́?",
      "question-9-family-history": "Ṣe ẹbí rẹ ní ìtàn àrùn ọkàn?",
    },
    ha: {
      "question-1-name": "Menene sunan ku?",
      "question-2-age": "Shekaru nawa kuke?",
      "question-3-sex": "Menene jinsin ku? Namiji, mace, ko wani?",
      "question-4-hypertension": "An tabbatar da ku da hawan jini mai girma?",
      "question-5-medications": "Kuna shan magunguna na yau da kullum?",
      "question-6-smoke-drink": "Kuna shan sigari ko giya?",
      "question-7-activity": "Menene matakin aikin ku? Karami, matsakaici, ko babba?",
      "question-8-sleep": "Awanni nawa kuke barci a kullum?",
      "question-9-family-history": "Akwai tarihin cutar zuciya a cikin iyali?",
    },
  },
  instructions: {
    en: {
      "place-finger-camera": "Place your finger gently over the back camera.",
      "reading-complete": "Your reading is complete.",
      "hold-still": "Hold still for 30 seconds.",
      "signal-good": "Signal quality is good. Keep holding.",
      "signal-poor": "Signal quality is poor. Please adjust your finger position.",
    },
    yo: {
      "place-finger-camera": "Fi ìka rẹ sí orí kámẹ́rà ẹ̀yìn.",
      "reading-complete": "Ìwé rẹ ti parí.",
      "hold-still": "Dúró fún ìgbà àádọ́ta ìṣẹ́jú.",
      "signal-good": "Ìpèlé àmì dára. Tẹ̀ ẹ́ sí i.",
      "signal-poor": "Ìpèlé àmì kò dára. Jọ̀wọ́ ṣe àtúnṣe ipo ìka rẹ.",
    },
    ha: {
      "place-finger-camera": "Sanya yatsa a kan kyamarar baya.",
      "reading-complete": "Karatun ku ya kare.",
      "hold-still": "Tsaya tsayin daka na dakika talatin.",
      "signal-good": "Ingancin sigina yana da kyau. Ci gaba da riƙewa.",
      "signal-poor": "Ingancin sigina bai kyau ba. Don Allah gyara matsayin yatsa.",
    },
  },
  confirmations: {
    en: {
      "got-it": "Got it.",
      "noted-history": "Got it — I've noted your history.",
      "baseline-set": "Your baseline has been set.",
      "reading-saved": "Your reading has been saved.",
    },
    yo: {
      "got-it": "Ó tó.",
      "noted-history": "Ó tó — Mo ti kọ́ ìtàn rẹ.",
      "baseline-set": "Ìpìlẹ̀ rẹ ti ṣètò.",
      "reading-saved": "Ìwé rẹ ti fipamọ́.",
    },
    ha: {
      "got-it": "Na gane.",
      "noted-history": "Na gane — Na lura da tarihin ku.",
      "baseline-set": "An saita ma'aunin ku.",
      "reading-saved": "An adana karatun ku.",
    },
  },
};

/**
 * Generate audio using YarnGPT TTS
 */
async function generateAudio(
  text: string,
  language: string
): Promise<Buffer> {
  const voice = VOICE_MAP[language] || "Idera";

  try {
    const response = await axios.post(
      "https://yarngpt.ai/api/v1/tts",
      {
        text: text.substring(0, 2000), // Max 2000 characters
        voice: voice,
        response_format: "mp3",
      },
      {
        headers: {
          Authorization: `Bearer ${YARNGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    throw new Error(`YarnGPT TTS failed for "${text}": ${error.message}`);
  }
}

/**
 * Save audio file to disk
 */
function saveAudioFile(
  category: string,
  language: string,
  filename: string,
  audioBuffer: Buffer
): void {
  const dir = path.join(BASE_DIR, category, language);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${filename}.mp3`);
  fs.writeFileSync(filePath, audioBuffer);
  console.log(`✅ Saved: ${category}/${language}/${filename}.mp3`);
}

/**
 * Generate all audio files
 */
async function generateAllAudio() {
  console.log("🎤 Starting audio generation...\n");

  let totalFiles = 0;
  let successCount = 0;
  let failCount = 0;

  // Generate for each category
  for (const [category, languages] of Object.entries(AUDIO_TEXTS)) {
    console.log(`\n📁 Category: ${category}`);
    
    for (const [language, texts] of Object.entries(languages)) {
      console.log(`  🌍 Language: ${language}`);
      
      for (const [filename, text] of Object.entries(texts)) {
        totalFiles++;
        try {
          console.log(`    Generating: ${filename}...`);
          const audioBuffer = await generateAudio(text, language);
          saveAudioFile(category, language, filename, audioBuffer);
          successCount++;
          
          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`    ❌ Failed: ${filename} - ${error.message}`);
          failCount++;
        }
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Generation Summary:");
  console.log(`   Total files: ${totalFiles}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log("=".repeat(50));

  if (failCount === 0) {
    console.log("\n🎉 All audio files generated successfully!");
  } else {
    console.log(`\n⚠️  ${failCount} file(s) failed. Check errors above.`);
  }
}

// Run the script
generateAllAudio().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

