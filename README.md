# OrthoForge Healing Analysis — Web Deployment Guide

This guide explains how to deploy your password-protected OrthoForge dashboard
as a website that anyone can access from any device — iPhone, Android, Windows PC,
Mac, iPad, or any web browser.

---

## What You're Getting

- A **password-protected** website hosted for free
- Works on **every device** with a web browser (no installs)
- You send people a **link and a password** — that's it
- You can update it anytime by re-deploying

**Default password:** `OrthoForge2024`
(You can change this later — instructions in Section 5)

---

## Section 1: What You Need Before Starting

1. **Node.js** — If you already have it from our earlier work, you're set.
   If not: go to https://nodejs.org → click the green LTS button → install it.

2. **A free Netlify account** — You'll create this in Section 3.

3. **The `orthoforge-web` project folder** — That's this folder you unzipped.

---

## Section 2: Build the Website Files

You only need to do this when something changes. It turns your code into
a ready-to-upload website.

### Step 2.1: Open PowerShell (Windows) or Terminal (Mac)

**Windows:**
- Open File Explorer
- Navigate to the `orthoforge-web` folder
- Click in the address bar at the top, type `powershell`, press Enter
- A blue PowerShell window opens inside this folder

**Mac:**
- Open Finder
- Navigate to the `orthoforge-web` folder
- Right-click the folder → "New Terminal at Folder"

### Step 2.2: Install dependencies (first time only)

Type this and press Enter:

```
npm install
```

Wait for it to finish. Ignore any yellow "warn" messages — those are normal.

### Step 2.3: Build the website

Type this and press Enter:

```
npm run build
```

You should see a message ending with "built in X seconds."

A folder called `dist` now exists inside your project. This folder IS your
entire website — it contains everything needed.

### Step 2.4: Test it locally (optional)

To preview the site on your own computer before deploying:

```
npm run preview
```

Open http://localhost:4173 in your browser. You should see the password screen.
Type `OrthoForge2024` and press Enter (or click Sign In). The dashboard appears.

Press Ctrl+C in the terminal to stop the preview when done.

---

## Section 3: Deploy to Netlify (Free Hosting)

There are two ways to deploy. **Method A is the easiest** — no account needed
for the first deploy, and it takes about 60 seconds.

### Method A: Drag-and-Drop (Easiest)

1. Open your web browser
2. Go to: https://app.netlify.com/drop
3. You'll see a big area that says "Drag and drop your site output folder here"
4. Open File Explorer (or Finder on Mac)
5. Navigate into your `orthoforge-web` folder
6. Find the `dist` folder inside it
7. **Drag the entire `dist` folder** from File Explorer onto the Netlify page
8. Wait 10-30 seconds
9. Netlify gives you a URL like: `https://random-name-123.netlify.app`

That's it! Your site is live. Open that URL on your phone to test it.

**IMPORTANT:** Netlify will ask you to create a free account to **claim** your
site. Do this so you can update it later and customize the URL.
- Click "Claim your site" or "Sign up"
- Create an account with your email
- The site is now saved to your account

### Method B: Deploy via Netlify CLI (More Control)

If you prefer command-line tools:

1. Install the Netlify CLI:
   ```
   npm install -g netlify-cli
   ```

2. Log in to Netlify:
   ```
   netlify login
   ```
   (This opens your browser to authorize)

3. Deploy:
   ```
   netlify deploy --dir=dist --prod
   ```

4. First time: it will ask you to create a new site or link an existing one.
   Choose "Create & configure a new site."

5. It gives you a URL. Done!

---

## Section 4: Customize Your URL (Optional)

By default, Netlify gives you a random URL like `random-name-123.netlify.app`.

### Change to a better name (free):

1. Log in to https://app.netlify.com
2. Click on your site
3. Go to **Site settings** → **Change site name**
4. Type something like `orthoforge-healing`
5. Your new URL: `https://orthoforge-healing.netlify.app`

### Use your own domain (optional, ~$12/year):

If you own a domain like `orthoforge.com`, you can connect it:
1. In Netlify: **Site settings** → **Domain management** → **Add custom domain**
2. Follow their instructions to update your DNS settings

---

## Section 5: How to Share With Clinicians

Send them this message (customize as needed):

> Subject: OrthoForge Healing Analysis — Access Link
>
> Here is your access to the OrthoForge Healing Analysis Dashboard:
>
> **Link:** https://orthoforge-healing.netlify.app
> **Password:** OrthoForge2024
>
> This works on any device — computer, phone, or tablet.
> Just open the link in any web browser (Chrome, Safari, Edge, Firefox).
>
> Quick start:
> 1. Open the link
> 2. Enter the password
> 3. Select a patient from the dropdown
> 4. Click "Play" to watch healing progress over time
> 5. Use the slider to jump to any week
>
> To load your own patient data, select "Import from file..."
> at the bottom of the patient dropdown.

---

## Section 6: How to Change the Password

1. Open the file `src/PasswordGate.jsx` in any text editor (Notepad, VS Code, etc.)

2. Find this line near the top (around line 10):
   ```
   const _k = "==QazRXYyNmchBHd";
   ```

3. To create a new encoded password:
   - Open your browser
   - Press F12 to open Developer Tools
   - Click the "Console" tab
   - Paste this command (replace YOUR_NEW_PASSWORD with what you want):
     ```
     btoa("YOUR_NEW_PASSWORD").split("").reverse().join("")
     ```
   - Press Enter
   - It will show you a string of characters — copy it

4. Replace the text between the quotes on that line with your new string.
   For example, if your new password is `Clinic2024`:
   ```
   const _k = "==QGN0MjJpNmcv5Cc";
   ```

5. Save the file.

6. Rebuild and redeploy:
   ```
   npm run build
   ```
   Then re-drag the `dist` folder to Netlify, or use `netlify deploy --dir=dist --prod`

---

## Section 7: How to Update the App

When you get an updated version of the code (or make changes yourself):

1. Open PowerShell/Terminal in the project folder
2. Run: `npm run build`
3. Deploy the new `dist` folder using either:
   - Drag-drop onto Netlify (go to your site → Deploys → drag the dist folder)
   - Or CLI: `netlify deploy --dir=dist --prod`

Updates go live within seconds. Users just refresh their browser.

---

## Section 8: Troubleshooting

**"npm: command not found"**
→ Node.js is not installed. Download from https://nodejs.org

**Build says "command not found: vite"**
→ Run `npm install` first, then `npm run build`

**Password screen doesn't appear**
→ Clear your browser cache (Ctrl+Shift+Delete → clear everything → try again)

**Clinician says "site not loading"**
→ Make sure they're using a modern browser (Chrome, Safari, Edge, Firefox)
→ Make sure the URL is correct (no typos)
→ Try opening in an incognito/private window

**Logo doesn't show on deployed site**
→ Make sure the `dist` folder contains `orthoforge-logo.png`
→ If missing, rebuild with `npm run build`

**Want to go back to testing locally?**
→ Run `npm run dev` to start the local development server

---

## Quick Reference

| Task                        | Command                                    |
|-----------------------------|--------------------------------------------|
| Install dependencies        | `npm install`                              |
| Test locally (development)  | `npm run dev`                              |
| Build for deployment        | `npm run build`                            |
| Preview the build locally   | `npm run preview`                          |
| Deploy to Netlify (CLI)     | `netlify deploy --dir=dist --prod`         |

---

## Folder Structure

```
orthoforge-web/
├── README.md            ← This file
├── package.json         ← Dependencies
├── vite.config.js       ← Build settings
├── netlify.toml         ← Hosting settings
├── index.html           ← Entry page
├── public/
│   └── orthoforge-logo.png
├── src/
│   ├── main.jsx         ← App entry (loads password gate)
│   ├── PasswordGate.jsx ← Password screen
│   └── App.jsx          ← Dashboard
└── dist/                ← Built website (created by "npm run build")
    ├── index.html
    ├── orthoforge-logo.png
    └── assets/
        └── index-xxxxx.js  ← Minified app code
```
