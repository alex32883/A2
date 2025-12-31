import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[API] Received image generation request')
    const { prompt } = req.body

    if (!prompt) {
      console.log('[API] Error: Prompt is missing')
      return res.status(400).json({ error: 'Prompt is required' })
    }
    
    console.log('[API] Prompt received:', prompt.substring(0, 100) + '...')

    const huggingFaceKey = process.env.VITE_HUGGINGFACE_API_KEY
    const replicateKey = process.env.VITE_REPLICATE_API_KEY
    
    // Use Hugging Face if available (preferred)
    if (huggingFaceKey) {
      return await generateImageWithHuggingFace(req, res, prompt, huggingFaceKey)
    }
    
    // Fallback to Replicate if Hugging Face key not available
    if (!replicateKey) {
      return res.status(500).json({ 
        error: 'No image generation API key configured. Please set VITE_HUGGINGFACE_API_KEY or VITE_REPLICATE_API_KEY' 
      })
    }
    
    return await generateImageWithReplicate(req, res, prompt, replicateKey)
  } catch (error) {
    console.error('Error generating image:', error)
    res.status(500).json({ error: error.message || 'Failed to generate image' })
  }
}

async function generateImageWithHuggingFace(req, res, prompt, huggingFaceKey) {
  try {
    console.log('[Hugging Face] Attempting image generation...')

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
      }
    ]
    
    let response
    let lastError
    let lastEndpointName
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[Hugging Face] Trying: ${endpoint.name}`)
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
        
        lastEndpointName = endpoint.name
        console.log(`[Hugging Face] Response status: ${response.status}`)
        
        if (response.ok) {
          console.log(`[Hugging Face] Success with: ${endpoint.name}`)
          break
        }
        
        if (response.status === 404 || response.status === 410 || response.status === 503) {
          console.log(`[Hugging Face] ${response.status} from ${endpoint.name}, trying next...`)
          continue
        }
        
        if (response.status !== 200 && response.status !== 201) {
          console.log(`[Hugging Face] Got status ${response.status}, stopping`)
          break
        }
      } catch (error) {
        lastError = error
        console.error(`[Hugging Face] Endpoint ${endpoint.name} failed:`, error.message)
        continue
      }
    }
    
    if (!response) {
      throw new Error(lastError?.message || 'Failed to connect to Hugging Face API')
    }

    if (!response.ok) {
      let errorMessage = 'Failed to generate image'
      const responseText = await response.text()
      console.log(`[Hugging Face] Error response (${response.status}):`, responseText.substring(0, 500))
      
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        errorMessage = responseText || errorMessage
      }

      if (response.status === 401 || response.status === 403) {
        errorMessage = `Authentication failed. Please verify your Hugging Face API key.`
      } else if (response.status === 410) {
        errorMessage = `The API endpoint is no longer available (410 Gone).`
      }

      return res.status(response.status).json({ error: errorMessage })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    res.setHeader('Content-Type', contentType)
    res.send(Buffer.from(imageBuffer))
  } catch (error) {
    console.error('[Hugging Face] Error:', error)
    throw error
  }
}

async function generateImageWithReplicate(req, res, prompt, apiKey) {
  try {
    console.log('[Replicate] Starting image generation...')
    
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
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
      throw new Error(`Replicate API error: ${errorText}`)
    }

    const prediction = await predictionResponse.json()
    console.log('[Replicate] Prediction created:', prediction.id)

    let result = null
    let attempts = 0
    const maxAttempts = 60

    while (!result && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${apiKey.trim()}`
        }
      })

      if (!statusResponse.ok) {
        throw new Error('Failed to check prediction status')
      }

      const status = await statusResponse.json()
      console.log(`[Replicate] Status: ${status.status}`)

      if (status.status === 'succeeded') {
        result = status.output[0]
        break
      } else if (status.status === 'failed') {
        throw new Error('Image generation failed on Replicate')
      }

      attempts++
    }

    if (!result) {
      throw new Error('Image generation timed out')
    }

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

