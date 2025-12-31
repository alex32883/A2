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

    // Get API base URL from environment variable or use relative path for production
    const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

    try {
      // Step 1: Generate prompt using OpenRouter API via proxy
      const promptResponse = await fetch(`${apiBaseUrl}/api/generate-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: inputText
        })
      })

      if (!promptResponse.ok) {
        let errorMessage = 'Failed to generate prompt'
        try {
          const errorData = await promptResponse.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${promptResponse.status}: ${promptResponse.statusText}`
        }
        throw new Error(errorMessage)
      }

      const promptData = await promptResponse.json()
      
      if (!promptData.prompt) {
        throw new Error('Invalid response from prompt generation service')
      }
      
      const enhancedPrompt = promptData.prompt

      // Step 2: Generate image using Hugging Face API via proxy
      const imageResponse = await fetch(`${apiBaseUrl}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: enhancedPrompt
        })
      })

      if (!imageResponse.ok) {
        let errorMessage = 'Failed to generate image'
        try {
          const errorData = await imageResponse.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await imageResponse.text()
          errorMessage = errorText || errorMessage
        }
        
        if (imageResponse.status === 401 || imageResponse.status === 403) {
          errorMessage = 'Authentication failed. Please verify your Hugging Face API key is correct in .env.local and restart the server.'
        } else if (imageResponse.status === 410) {
          errorMessage = 'The Hugging Face API endpoint is no longer available (410 Gone). The API may have been deprecated. Please check the server console for details or consider using an alternative image generation service.'
        } else if (imageResponse.status === 503) {
          errorMessage = 'Model is loading. Please wait a moment and try again.'
        }
        
        throw new Error(errorMessage)
      }

      // Get the image blob
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

