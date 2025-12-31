import { useState } from 'react'
import './App.css'

function App() {
  const [inputText, setInputText] = useState('')
  const [generatedImage, setGeneratedImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generateImage = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedImage(null)

    try {
      // Step 1: Generate prompt using OpenRouter API
      const promptResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Image Generator App'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a prompt engineer. Convert the user\'s text into a detailed, descriptive prompt for image generation. Make it vivid and detailed, suitable for creating high-quality images.'
            },
            {
              role: 'user',
              content: `Create a detailed image generation prompt for: "${inputText}"`
            }
          ],
          max_tokens: 200
        })
      })

      if (!promptResponse.ok) {
        let errorMessage = 'Failed to generate prompt'
        try {
          const errorData = await promptResponse.json()
          errorMessage = errorData.error?.message || errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${promptResponse.status}: ${promptResponse.statusText}`
        }
        throw new Error(errorMessage)
      }

      const promptData = await promptResponse.json()
      
      if (!promptData.choices || !promptData.choices[0] || !promptData.choices[0].message) {
        throw new Error('Invalid response from prompt generation service')
      }
      
      const enhancedPrompt = promptData.choices[0].message.content

      // Step 2: Generate image using Hugging Face API
      const imageResponse = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: enhancedPrompt
          })
        }
      )

      if (!imageResponse.ok) {
        // Try to parse error as JSON first
        let errorMessage = 'Failed to generate image'
        try {
          const errorData = await imageResponse.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          const errorText = await imageResponse.text()
          errorMessage = errorText || errorMessage
        }
        
        if (imageResponse.status === 503) {
          errorMessage = 'Model is loading. Please wait a moment and try again.'
        }
        
        throw new Error(errorMessage)
      }

      // Check if response is actually an image
      const contentType = imageResponse.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        const errorData = await imageResponse.text()
        throw new Error(`Unexpected response format: ${errorData}`)
      }

      const imageBlob = await imageResponse.blob()
      const imageUrl = URL.createObjectURL(imageBlob)
      setGeneratedImage(imageUrl)
    } catch (err) {
      setError(err.message || 'An error occurred while generating the image')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">AI Image Generator</h1>
        <p className="subtitle">Enter text to generate an image</p>

        <div className="input-section">
          <textarea
            className="input-field"
            placeholder="Enter your text here... (e.g., 'a beautiful sunset over mountains')"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={4}
            disabled={loading}
          />
          <button
            className="generate-button"
            onClick={generateImage}
            disabled={loading || !inputText.trim()}
          >
            {loading ? 'Generating...' : 'Image'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="output-section">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Generating your image...</p>
            </div>
          )}
          {generatedImage && !loading && (
            <div className="image-container">
              <img src={generatedImage} alt="Generated" className="generated-image" />
            </div>
          )}
          {!generatedImage && !loading && (
            <div className="placeholder">
              <p>Generated image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

