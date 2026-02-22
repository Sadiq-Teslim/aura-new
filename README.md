# COR – Backend

Signal Processing • Machine Learning • Risk Intelligence

The COR backend powers cardiovascular risk estimation using smartphone-derived photoplethysmography (PPG), lifestyle signals, and machine learning–based trend modeling.

This service processes raw pulse waveform data and returns estimated blood pressure trends, HRV metrics, and cardiovascular risk insights.

---

## Overview

COR transforms smartphone sensor data into structured cardiovascular intelligence.

The backend is responsible for:

* PPG signal preprocessing
* Feature extraction (HRV & pulse morphology)
* Blood pressure estimation
* Longitudinal trend modeling
* Lifestyle risk correlation
* Confidence scoring
* API responses to frontend dashboard

COR is designed as a screening and early-risk detection system, not a diagnostic medical device.

---

## Core Processing Pipeline

### 1. Signal Acquisition

* 10-second PPG signal from camera frames
* RGB channel intensity extraction
* Time-series signal construction

### 2. Signal Preprocessing

* Bandpass filtering (0.5–5 Hz)
* Noise reduction
* Peak detection
* Signal normalization

### 3. Feature Extraction

Extracted features include:

* Heart Rate (HR)
* Heart Rate Variability (RMSSD, SDNN)
* Peak-to-peak intervals
* Pulse amplitude variability
* Systolic upstroke time
* Pulse width
* Arterial stiffness indicators

### 4. Blood Pressure Estimation

Features are fed into a regression model such as:

* Linear Regression
* Random Forest
* Optional Neural Network extension

Outputs:

* Estimated Systolic BP
* Estimated Diastolic BP
* Confidence Score

### 5. Longitudinal Trend Modeling

* Rolling 7-day average
* Deviation from baseline
* Risk escalation detection
* Cardiovascular Risk Score (0–100)

### 6. Lifestyle Correlation Engine

Inputs:

* Sleep duration estimate
* Activity level
* Screen time patterns
* Food sodium classification

Outputs:

* Risk factor correlation
* Preventive recommendation generation

---

## Tech Stack

* Node.js / Express (API layer)
* Python (Signal Processing & ML layer)
* NumPy / SciPy (Signal filtering)
* scikit-learn (Regression models)
* TensorFlow / PyTorch (Advanced modeling optional)
* PostgreSQL or MongoDB (Data storage)
* Redis (Caching recent measurements)

---

## API Endpoints

### POST /api/measure

Accepts:

* Raw PPG signal array
* Timestamp
* User metadata (optional)

Returns:

* systolic (number)
* diastolic (number)
* hr (number)
* hrv (number)
* riskScore (number)
* confidence (number)
* recommendation (string)

---

### GET /api/trend/:userId

Returns:

* 7-day trend data
* Risk progression
* Baseline comparison

---

### POST /api/lifestyle

Accepts:

* Sleep hours
* Activity metrics
* Sodium classification
* Screen time data

Returns:

* Lifestyle-adjusted risk insights

---

## Validation Strategy

Validation includes:

* Paired digital cuff measurements
* Correlation coefficient analysis
* Mean Absolute Error (MAE) calculation
Continuing and completing the cleaned 
* Root Mean Squared Error (RMSE) calculation
* Confidence interval reporting

Evaluation metrics used:

* Pearson Correlation Coefficient (R)
* Mean Absolute Error (mmHg)
* Root Mean Squared Error (RMSE)

Each blood pressure estimate is returned with a confidence score to promote transparency and responsible usage.

---

## Data Handling & Privacy

COR prioritizes responsible data management.

* No raw video data is stored
* Only processed signal features are retained
* Sensitive user data is encrypted at rest
* Secure API communication (HTTPS)
* User-identifiable data separated from signal data
* Designed with GDPR-aligned principles

---

## Project Structure

/backend

* /routes
* /controllers
* /services
* /ml
* /utils
* server.js
* requirements.txt

---

## Environment Variables

Create a `.env` file in the root directory:

PORT=5000
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_secret_key

---

## Installation

Clone the repository:

git clone [https://github.com/your-username/cor-backend.git](https://github.com/your-username/cor-backend.git)
cd cor-backend

Install Node dependencies:

npm install

Install Python dependencies:

pip install -r requirements.txt

---

## Running the Server

Start development server:

npm run dev

The server runs on:

[http://localhost:5000](http://localhost:5000)

---

## Error Handling

* Structured API error responses
* Validation for malformed signal data
* Confidence threshold detection
* Fallback recommendations if signal quality is low

If signal quality is insufficient, the API returns:

* Low confidence score
* Prompt to re-measure

---

## Limitations

* PPG-based estimation is influenced by lighting conditions and finger placement
* Accuracy depends on calibration dataset quality
* Not validated for clinical diagnosis
* Requires further large-scale clinical validation for commercial deployment

---

## Medical Disclaimer

COR provides estimated cardiovascular risk insights derived from optical pulse signals. It is not intended for medical diagnosis or treatment. Users should confirm abnormal readings using certified medical devices and consult qualified healthcare professionals.

---

## Theme Alignment

Hackathon Theme: From Data to Prevention – Healthcare as a Tool

COR converts passive smartphone signals into actionable cardiovascular risk intelligence, enabling early screening and preventive action before acute medical events occur.