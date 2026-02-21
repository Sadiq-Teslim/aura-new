# Audio Generation Script

## Usage

Generate all pre-generated audio files:

```bash
npm run generate-audio
```

## What It Does

1. Connects to YarnGPT TTS API
2. Generates audio for:
   - **Onboarding questions** (9 questions × 3 languages = 27 files)
   - **Instructions** (5 instructions × 3 languages = 15 files)
   - **Confirmations** (4 confirmations × 3 languages = 12 files)
3. Saves files to `public/audio/{category}/{language}/{filename}.mp3`

## Requirements

- `YARNGPT_API_KEY` in `.env` file
- Internet connection (calls YarnGPT API)

## Output Structure

```
public/audio/
├── onboarding/
│   ├── en/
│   │   ├── question-1-name.mp3
│   │   ├── question-2-age.mp3
│   │   └── ...
│   ├── yo/
│   │   └── ...
│   └── ha/
│       └── ...
├── instructions/
│   ├── en/
│   ├── yo/
│   └── ha/
└── confirmations/
    ├── en/
    ├── yo/
    └── ha/
```

## Total Files Generated

- **54 audio files** total
- **3 languages**: English, Yoruba, Hausa
- **3 categories**: onboarding, instructions, confirmations

## Notes

- Script includes 500ms delay between requests to avoid rate limiting
- Failed files will be logged but won't stop the script
- All files are saved as MP3 format

