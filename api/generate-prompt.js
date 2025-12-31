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
        'HTTP-Referer': req.headers.origin || 'https://your-app.vercel.app',
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
}

