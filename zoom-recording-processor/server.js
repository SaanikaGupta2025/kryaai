require('dotenv').config(); // Load environment variables

console.log('Loading environment variables...');
console.log('process.env.ZOOM_CLIENT_ID:', process.env.ZOOM_CLIENT_ID);

const express = require('express');
const axios = require('axios'); // Or your preferred HTTP client
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI;

// --- In-memory token storage (for development ONLY) ---
let currentAccessToken = null;
let currentRefreshToken = null;
// -----------------------------------------------------

// Serve static files (optional, if you have a simple frontend)
// app.use(express.static('public')); // Uncomment if you have a 'public' directory for static files

// Define routes
app.get('/', (req, res) => {
  res.send('Zoom Recording Processor Backend');
});

// OAuth Authorization Route
app.get('/auth/zoom', (req, res) => {
  // Step 1: Redirect user to Zoom for authorization
  // Ensure all necessary scopes are included here
  const scopes = 'meeting:read:meeting_transcript recording:read:user_recordings user:read:user';
  const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${ZOOM_CLIENT_ID}&redirect_uri=${ZOOM_REDIRECT_URI}&scope=${encodeURIComponent(scopes)}`;

  console.log('Redirecting to Zoom authorization URL:', authUrl);

  res.redirect(authUrl);
});

// OAuth Callback Route
app.get('/oauth/callback', async (req, res) => {
  // Step 3: Handle the redirect and exchange code for tokens
  const { code, state } = req.query;

  // TODO: Implement more robust state check in production
  // if (state !== 'your_secure_state_string') {
  //   return res.status(403).send('State mismatch');
  // }

  if (!code) {
    return res.status(400).send('Authorization code not received.');
  }

  try {
    // Step 4: Exchange code for tokens
    const tokenUrl = 'https://zoom.us/oauth/token';
    const authHeader = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await axios.post(tokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ZOOM_REDIRECT_URI
      },
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Step 5: Store tokens securely (using in-memory for dev)
    currentAccessToken = access_token;
    currentRefreshToken = refresh_token;

    console.log('OAuth Successful! Tokens stored in memory (dev only).');
    // Removed direct console logging of tokens for security

    res.send(`
      <h1>OAuth Successful!</h1>
      <p>Tokens received and stored in memory (for development only).</p>
      <p>You can now use the API routes.</p>
      <p><strong>WARNING: This in-memory storage is NOT secure for production!</strong></p>
    `);

  } catch (error) {
    console.error('Error during OAuth token exchange:', error.response ? error.response.data : error.message);
    res.status(500).send('Error during OAuth token exchange.');
  }
});

// Function to extract action items and deadlines from spoken text
async function extractActionItemsFromText(spokenText) {
  const actionItems = [];
  // Simple sentence splitting (may need refinement for complex text)
  const sentences = spokenText.split('. '); // Split by period and space

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence === '') continue;

    // Basic pattern matching for action items and deadlines
    // Look for "to be done by [date/time]" or "send [something] by [date/time]"
    
    // Pattern 1: "... to be done by [date/time]"
    const doneByMatch = trimmedSentence.match(/(.+?) to be done by (.+)/i);
    if (doneByMatch) {
      // Capture the part before "to be done by" as item, and after as deadline
      const itemPart = doneByMatch[1].trim();
      const deadlinePart = doneByMatch[2].trim();
      actionItems.push({
        item: itemPart + ' to be done',
        deadline: deadlinePart
      });
    }

    // Pattern 2: "(send|please send) [something] by [date/time]"
    const sendByMatch = trimmedSentence.match(/(?:send|please send) (.+?) by (.+)/i);
     if (sendByMatch) {
      // Capture the part after "send/please send" and before "by" as item, and after "by" as deadline
      const itemPart = sendByMatch[1].trim();
      const deadlinePart = sendByMatch[2].trim();
      actionItems.push({
        item: 'Send ' + itemPart,
        deadline: deadlinePart
      });
    }

    // TODO: Add more patterns as needed
    // e.g., looking for "I will", "we need to", "due on", etc.

  }

  return actionItems;
}

// Function to parse VTT transcript content
async function parseVttTranscript(vttContent) {
  const lines = vttContent.split('\n');
  let spokenText = '';
  let inCue = false; // Flag to indicate if we are inside a VTT cue block

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (trimmedLine === '') {
      inCue = false; // Reset flag on empty line
      continue;
    }

    // Skip WEBVTT header
    if (trimmedLine === 'WEBVTT') {
      continue;
    }

    // Detect start of a new cue (line containing timestamp)
    if (trimmedLine.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/)) {
      inCue = true;
      continue;
    }

    // If we are in a cue, process lines that are not timestamps or speaker labels
    if (inCue) {
      // Skip speaker labels (lines starting with <v Speaker Name>)
      if (trimmedLine.startsWith('<v') && trimmedLine.endsWith('>')) {
        continue;
      }

      // Add the spoken text line, potentially with a space if it's not the first line after a break
      if (spokenText !== '') {
          spokenText += ' '; // Add space between text chunks
      }
      spokenText += trimmedLine;
    }
  }

  // Basic cleanup: replace multiple spaces with single space
  spokenText = spokenText.replace(/\s+/g, ' ').trim();

  return spokenText;
}

// Example function to fetch user recordings
async function getUserRecordings() {
  if (!currentAccessToken) {
    console.error('No access token available. Please authorize first.');
    throw new Error('No access token available.');
  }

  try {
    const apiUrl = 'https://api.zoom.us/v2/users/me/recordings';
    console.log('Attempting to fetch recordings with current access token...');
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Zoom API Response (Recordings):', response.data);
    return response.data;
  } catch (error) {
    // Check if the error is due to an expired or invalid token (Zoom error code 124)
    if (error.response && error.response.data && error.response.data.code === 124) {
      console.warn('Access token expired or invalid. Attempting to refresh token...');
      try {
        // Attempt to refresh the token
        const newAccessToken = await refreshAccessToken();
        // Retry the original API call with the new token
        console.log('Retrying recordings fetch with new access token...');
        const retryResponse = await axios.get(apiUrl, {
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Zoom API Response (Recordings - Retry):', retryResponse.data);
        return retryResponse.data;
      } catch (refreshError) {
        console.error('Failed to refresh token and retry API call.', refreshError.response ? refreshError.response.data : refreshError.message);
        throw new Error('Authentication failed after token refresh attempt.'); // Indicate a final auth failure
      }
    } else {
      // Handle other API errors
      console.error('Error fetching recordings:', error.response ? error.response.data : error.message);
      throw error; // Re-throw other errors
    }
  }
}

// New route to trigger fetching recordings (for testing)
app.get('/api/recordings', async (req, res) => {
  // No need to manually set accessToken here anymore, it's stored in memory
  // We just need to make sure it exists before calling the function.

  if (!currentAccessToken) {
      return res.status(401).send('No access token available. Please authorize first by visiting /auth/zoom');
  }

  try {
    const recordingsData = await getUserRecordings(); // Call without passing token, function uses stored token

    // --- Process recordingsData to find and download transcript ---
    if (recordingsData && recordingsData.meetings && recordingsData.meetings.length > 0) {
      console.log(`Found ${recordingsData.total_records} meeting(s) with recordings.`);

      // Assuming you want to process the most recent meeting with recordings
      const latestMeeting = recordingsData.meetings[0]; 
      console.log(`Processing latest meeting: ${latestMeeting.topic} (${latestMeeting.id})`);

      const transcriptFile = latestMeeting.recording_files.find(file => file.file_type === 'TRANSCRIPT' && file.status === 'completed');

      if (transcriptFile) {
        console.log('Found transcript file:', transcriptFile.download_url);

        // Download the transcript file content
        try {
          const transcriptResponse = await axios.get(transcriptFile.download_url, {
            headers: {
              'Authorization': `Bearer ${currentAccessToken}` // Use the current access token for download
            }
          });

          const transcriptContent = transcriptResponse.data; // The VTT content
          console.log('Transcript Content:', transcriptContent); // Log the transcript content

          // Parse the VTT content to get spoken text
          const spokenText = await parseVttTranscript(transcriptContent);
          console.log('Parsed Spoken Text:', spokenText);

          // --- Start of Action Item Extraction Logic ---
          const extractedItems = await extractActionItemsFromText(spokenText);
          console.log('Extracted Action Items:', extractedItems);
          // --- End of Action Item Extraction Logic ---

          // TODO: Send extractedItems to dashboard/storage
          // For now, display extracted items in the response

          res.status(200).send(`
            <h1>Recordings Found</h1>
            <p>Processed latest meeting: ${latestMeeting.topic}</p>
            <h2>Extracted Action Items:</h2>
            <pre>${JSON.stringify(extractedItems, null, 2)}</pre>
          `);

        } catch (downloadError) {
          console.error('Error downloading transcript file:', downloadError.response ? downloadError.response.data : downloadError.message);
          res.status(500).send('Failed to download transcript file.');
        }

      } else {
        console.log('No completed transcript file found for the latest meeting.');
        res.status(200).send('No completed transcript file found for the latest meeting.');
      }

    } else {
      console.log('No recordings found for the authorized user.');
      res.status(200).send('No recordings found for the authorized user.');
    }
    // --- End of processing recordingsData ---

  } catch (error) {
    // Catch errors from getUserRecordings (including refresh failures)
    console.error('Request to /api/recordings failed:', error.message);
    res.status(500).send(`Failed to fetch recordings: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
}); 