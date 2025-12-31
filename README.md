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
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

3. Get your API keys:
   - **OpenRouter API Key**: Sign up at [OpenRouter.ai](https://openrouter.ai/) and get your API key
   - **Hugging Face API Key**: Sign up at [Hugging Face](https://huggingface.co/) and create an access token in your settings

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter your text description in the input field (e.g., "a beautiful sunset over mountains")
2. Click the "Image" button
3. Wait for the image to be generated (this may take 10-30 seconds)
4. The generated image will appear in the output window

## Technologies

- React 18
- Vite
- OpenRouter API (for prompt generation)
- Hugging Face API (for image generation)

