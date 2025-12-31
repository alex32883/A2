import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') })

const app = express()
const PORT = 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))
app.use(express.json())

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Test route to verify server is running
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' })
})

// Proxy endpoint for OpenRouter API
app.post('/api/generate-prompt', async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    const openRouterKey = process.env.VITE_OPENROUTER_API_KEY
    if (!openRouterKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured' })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': req.headers.origin || 'http://localhost:3000',
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
            content: `Create a detailed image generation prompt for: "${text}"`
          }
        ],
        max_tokens: 200
      })
    })

    if (!response.ok) {
      let errorMessage = 'Failed to generate prompt'
      const responseText = await response.text()
      
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.error?.message || errorData.error || errorMessage
      } catch {
        errorMessage = responseText || errorMessage
      }
      
      return res.status(response.status).json({ error: errorMessage })
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ error: 'Invalid response from prompt generation service' })
    }

    res.json({ prompt: data.choices[0].message.content })
  } catch (error) {
    console.error('Error generating prompt:', error)
    res.status(500).json({ error: error.message || 'Failed to generate prompt' })
  }
})

// Proxy endpoint for Image Generation API
// Using Replicate API as Hugging Face Inference API is deprecated (410 Gone)
app.post('/api/generate-image', async (req, res) => {
  try {
    console.log('[API] Received image generation request')
    const { prompt } = req.body

    if (!prompt) {
      console.log('[API] Error: Prompt is missing')
      return res.status(400).json({ error: 'Prompt is required' })
    }
    
    console.log('[API] Prompt received:', prompt.substring(0, 100) + '...')

    // Try Replicate API first (more reliable), fallback to Hugging Face if needed
    const replicateKey = process.env.VITE_REPLICATE_API_KEY
    const huggingFaceKey = process.env.VITE_HUGGINGFACE_API_KEY
    
    // Use Hugging Face if available (preferred)
    if (huggingFaceKey) {
      return await generateImageWithHuggingFace(req, res, prompt, huggingFaceKey)
    }
    
    // Fallback to Replicate if Hugging Face key not available
    if (!replicateKey) {
      return res.status(500).json({ 
        error: 'No image generation API key configured. Please set VITE_HUGGINGFACE_API_KEY or VITE_REPLICATE_API_KEY in .env.local' 
      })
    }
    
    return await generateImageWithReplicate(req, res, prompt, replicateKey)
  } catch (error) {
    console.error('Error generating image:', error)
    res.status(500).json({ error: error.message || 'Failed to generate image' })
  }
})

async function generateImageWithReplicate(req, res, prompt, apiKey) {
  try {
    console.log('[Replicate] Starting image generation...')
    
    // Create a prediction
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf', // stable-diffusion-2.1
        input: {
          prompt: prompt,
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5,
          width: 512,
          height: 512
        }
      })
    })

    if (!predictionResponse.ok) {
      const errorText = await predictionResponse.text()
      console.error('[Replicate] Prediction creation failed:', errorText)
      throw new Error(`Replicate API error: ${errorText}`)
    }

    const prediction = await predictionResponse.json()
    console.log('[Replicate] Prediction created:', prediction.id)

    // Poll for completion
    let result = null
    let attempts = 0
    const maxAttempts = 60 // 60 seconds timeout

    while (!result && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${apiKey.trim()}`
        }
      })

      if (!statusResponse.ok) {
        throw new Error('Failed to check prediction status')
      }

      const status = await statusResponse.json()
      console.log(`[Replicate] Status: ${status.status} (attempt ${attempts + 1})`)

      if (status.status === 'succeeded') {
        result = status.output[0] // Get the first image URL
        break
      } else if (status.status === 'failed') {
        throw new Error('Image generation failed on Replicate')
      }

      attempts++
    }

    if (!result) {
      throw new Error('Image generation timed out')
    }

    // Fetch the image from the URL
    console.log('[Replicate] Fetching image from:', result)
    const imageResponse = await fetch(result)
    
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch generated image')
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/png'

    res.setHeader('Content-Type', contentType)
    res.send(Buffer.from(imageBuffer))
  } catch (error) {
    console.error('[Replicate] Error:', error)
    throw error
  }
}

async function generateImageWithHuggingFace(req, res, prompt, huggingFaceKey) {
  try {
    console.log('[Hugging Face] Attempting image generation...')

    // Try the new router endpoint format first, then fallback to old inference API
    const endpoints = [
      {
        url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
        name: 'Router API - SDXL'
      },
      {
        url: 'https://router.huggingface.co/hf-inference/models/runwayml/stable-diffusion-v1-5',
        name: 'Router API - SD v1.5'
      },
      {
        url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-1',
        name: 'Router API - SD 2.1'
      },
      {
        url: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
        name: 'Inference API - SDXL (fallback)'
      },
      {
        url: 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
        name: 'Inference API - SD v1.5 (fallback)'
      }
    ]
    
    let response
    let lastError
    let lastStatus
    let lastEndpointName
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[Hugging Face] Trying: ${endpoint.name} (${endpoint.url})`)
        response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${huggingFaceKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt
          })
        })
        
        lastStatus = response.status
        lastEndpointName = endpoint.name
        
        console.log(`[Hugging Face] Response status: ${response.status} from ${endpoint.name}`)
        
        // If we get a successful response (2xx), break
        if (response.ok) {
          console.log(`[Hugging Face] Success with: ${endpoint.name}`)
          break
        }
        
        // For 404, 410 (Gone), or 503 (model loading), try next endpoint
        if (response.status === 404) {
          console.log(`[Hugging Face] 404 from ${endpoint.name}, trying next endpoint...`)
          continue
        }
        
        if (response.status === 410) {
          console.log(`[Hugging Face] 410 (Gone) from ${endpoint.name}, trying next endpoint...`)
          continue
        }
        
        if (response.status === 503) {
          console.log(`[Hugging Face] 503 (model loading) from ${endpoint.name}, trying next endpoint...`)
          continue
        }
        
        // If we get other errors (like 401, 403), break to show the actual error
        if (response.status !== 200 && response.status !== 201) {
          console.log(`[Hugging Face] Got status ${response.status} from ${endpoint.name}, stopping`)
          break
        }
      } catch (error) {
        lastError = error
        console.error(`[Hugging Face] Endpoint ${endpoint.name} failed:`, error.message)
        continue
      }
    }
    
    if (!response) {
      const errorMsg = lastError?.message || 'Failed to connect to Hugging Face API'
      console.error(`[Hugging Face] All endpoints failed. Last error: ${errorMsg}`)
      throw new Error(errorMsg)
    }

    if (!response.ok) {
      let errorMessage = 'Failed to generate image'
      
      // Read the response text first (can only be read once)
      const responseText = await response.text()
      console.log(`[Hugging Face] Error response (${response.status}):`, responseText.substring(0, 500))
      
      // Try to parse as JSON if possible
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        // If not JSON, use the text as error message
        errorMessage = responseText || errorMessage
      }

      if (response.status === 401 || response.status === 403) {
        errorMessage = `Authentication failed (${lastEndpointName || 'unknown endpoint'}). Please verify your Hugging Face API key is correct in .env.local and restart the server.`
      } else if (response.status === 410) {
        errorMessage = `The API endpoint is no longer available (410 Gone). The Hugging Face API endpoint may have been deprecated or changed. Please check the Hugging Face documentation for the current endpoint.`
      } else if (response.status === 503) {
        errorMessage = `Model is loading on ${lastEndpointName || 'the endpoint'}. Please wait a moment and try again.`
      } else if (response.status === 404) {
        errorMessage = `Model not found on ${lastEndpointName || 'the endpoint'}. The model may not be available or the endpoint URL is incorrect.`
      }

      console.error(`[Hugging Face] Final error message: ${errorMessage}`)
      return res.status(response.status).json({ error: errorMessage })
    }

    // Get the image as a buffer
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    // Send the image back to the client
    res.setHeader('Content-Type', contentType)
    res.send(Buffer.from(imageBuffer))
  } catch (error) {
    console.error('[Hugging Face] Error:', error)
    throw error
  }
}

// Catch-all for undefined routes (must be last)
app.use((req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.path}`)
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

