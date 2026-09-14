# Medical Admission OMR Scanner (100 Questions)

A client-side OMR (Optical Mark Recognition) Scanner calibrated specifically for **Medical Admission MBBS/BDS Question Paper (100 Questions, Options A–D)**.

Built with OpenCV.js, HTML5, CSS, and modern JavaScript. All image processing runs 100% in your browser. No server or backend needed.

---

## 🚀 How to Deploy on GitHub Pages (Free, 2 Minutes)

Follow these simple steps to host this scanner online on GitHub Pages:

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com) and click **"New repository"**.
2. Name it `omr-scanner` (or any name you prefer).
3. Choose **Public**.
4. Click **Create repository**.

### Step 2: Upload Files
1. Click **"uploading an existing file"** (or use git push).
2. Upload these files to the root of the repo:
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
3. Click **Commit changes**.

### Step 3: Enable GitHub Pages
1. In your repository, go to **Settings** (tab at the top right).
2. On the left sidebar, click **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: select `main` (or `master`) and folder `/ (root)`
4. Click **Save**.
5. Wait ~30 seconds, refresh the page. You will see your live URL:
   `https://<your-username>.github.io/omr-scanner/`

---

## 📱 How to Use with Your Medical Exam Console

1. Open your OMR Scanner on your phone or computer.
2. Tap **"Take / Choose Photo"** or use the **Live Camera** to photograph your completed physical OMR sheet.
3. OpenCV.js corrects perspective, aligns the columns, and evaluates the 100 question bubbles.
4. Review the results:
   - **Answered (Green)**: Confident detected answers
   - **Blank (Gray)**: Unmarked questions
   - **Multiple (Red)**: Questions where 2 or more options are filled (never guessed silently!)
   - **Uncertain (Yellow)**: Borderline marks that need your manual eye
5. Click **"Copy Console Code"** (or **"Select + Submit"**).
6. Open your Medical Exam website in your browser.
7. Open **Developer Tools** (`F12` or `Ctrl + Shift + J` or right-click -> Inspect -> Console).
8. Paste the copied JavaScript code into the console and press **Enter**.
9. The exam page calls `window.handleAnswer(qIndex, choice)` for each question and `window.updateProgress()`.
10. All your physical OMR answers are now selected on the exam console!

---

## ⚙️ Layout Calibration Specification
- Total Questions: 100
- Column 1: Questions 1–25
- Column 2: Questions 26–50
- Column 3: Questions 51–75
- Column 4: Questions 76–100
- Options per question: A, B, C, D
- 1-Based OMR index converts to 0-Based console index: `OMR Q1` -> `handleAnswer(0, "a")`.
