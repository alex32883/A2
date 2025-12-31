# AI Image Generator

A web application that generates images from text input using OpenRouter API for prompt enhancement and Hugging Face API for image generation.

## Features

- Text input for image description
- Automatic prompt enhancement using OpenRouter API (GPT-4o-mini)
- Image generation using Hugging Face Stable Diffusion XL
- Modern, responsive UI
- Real-time loading states and error handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with your API keys:
```
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
VITE_REPLICATE_API_KEY=your_replicate_api_key_here
# OR (as fallback, but may be deprecated)
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

3. Get your API keys:
   - **OpenRouter API Key**: Sign up at [OpenRouter.ai](https://openrouter.ai/) and get your API key
   - **Replicate API Key** (Recommended): Sign up at [Replicate.com](https://replicate.com/), go to Account Settings → API Tokens, and create a token. This is the recommended service as Hugging Face Inference API is deprecated.
   - **Hugging Face API Key** (Fallback): Sign up at [Hugging Face](https://huggingface.co/) and create an access token. Note: The Inference API may return 410 Gone errors as it's been deprecated.

4. Install the new dependencies:
```bash
npm install
```

5. Start both the backend server and frontend development server:
```bash
npm run dev:all
```

   Or run them separately in two terminals:
   - Terminal 1: `npm run server` (runs on http://localhost:3001)
   - Terminal 2: `npm run dev` (runs on http://localhost:3000)

6. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter your text description in the input field (e.g., "a beautiful sunset over mountains")
2. Click the "Image" button
3. Wait for the image to be generated (this may take 10-30 seconds)
4. The generated image will appear in the output window

## Deployment to Vercel

1. **Push your code to GitHub**

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add these variables:
     - `VITE_OPENROUTER_API_KEY` = your OpenRouter API key
     - `VITE_HUGGINGFACE_API_KEY` = your Hugging Face API key (or `VITE_REPLICATE_API_KEY`)

4. **Deploy:**
   - Vercel will automatically detect the Vite project
   - The API routes in `/api` will be deployed as serverless functions
   - Your app will be available at `https://your-app.vercel.app`

**Note:** The frontend automatically uses relative paths in production, so it will work with Vercel's serverless functions.

## Technologies

- React 18
- Vite
- Express (for local development)
- Vercel Serverless Functions (for production)
- OpenRouter API (for prompt generation)
- Hugging Face API (for image generation)
- Replicate API (for image generation - fallback)

