// script1-js.js

document.addEventListener('DOMContentLoaded', () => {
    // === Constants ===
    const FLASK_BASE_URL = 'http://localhost:5000'; // Replace if different
    const API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with your actual API key
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const MAX_HISTORY_LENGTH = 5; // Number of conversation turns to remember
    const TYPING_SPEED_FACTOR = 10; // Words per second approx (lower number = faster typing)

    // === DOM Element Selections ===
    const typingForm = document.getElementById("main-input-form"); // Use ID
    const inputElement = typingForm.querySelector(".typing-input"); // Textarea
    const sendButton = document.getElementById("send-button"); // Use ID
    const chatList = document.querySelector(".chat-list");
    const toggleThemeButton = document.getElementById("toggle-theme-button"); // Use ID
    const deleteChatButton = document.getElementById("delete-chat-button"); // Use ID
    const languageSelect = document.getElementById('languageSelect');
    const suggestionContainers = document.querySelectorAll('.suggestions-container'); // Get all containers
    const scrollUpButton = document.getElementById('scrollUp');
    const scrollDownButton = document.getElementById('scrollDown');
    const disclaimerText = document.querySelector('.disclaimer-text');
    // Add this element in your HTML near the input field: <ul id="autocomplete-list"></ul>
    const autocompleteList = document.getElementById('autocomplete-list');

    // === State Variables ===
    let userMessage = null;
    let isResponseGenerating = false;
    let currentLanguage = 'en'; // Default language
    let conversationHistory = [];
    let queryFrequency = {};
    let currentSuggestionGroup = 1; // Track active suggestion group (1, 2, or 3)
    let isTypingPaused = false;
    let currentTypingInterval = null;

    // === Translations (Keep as is) ===
    const translations = {
        en: {
            welcome: "SRM InfoBot - Your 24/7 University Assistant",
            placeholder: "Ask anything about SRM University...",
            // ... other 'en' translations
             suggestions: { // Match keys to data-original-text if using that method
                admissionProcess: "Admission Process", campusLife: "Campus Life", academicPortal: "Academic Portal", placements: "Placements",
                courseOfferings: "Course Offerings", studentLife: "Student Life", researchPrograms: "Research Programs", alumniNetwork: "Alumni Network",
                academicCalendar: "Academic Calendar", libraryResources: "Library Resources", sportsFacilities: "Sports Facilities", healthServices: "Health Services"
             }
        },
        ta: {
            welcome: "SRM இன்ஃபோபாட் - உங்கள் 24/7 பல்கலைக்கழக உதவியாளர்",
            placeholder: "SRM பல்கலைக்கழகம் பற்றி எதையும் கேளுங்கள்...",
            // ... other 'ta' translations
            suggestions: { admissionProcess: "சேர்க்கை செயல்முறை", campusLife: "வளாக வாழ்க்கை", academicPortal: "கல்வி போர்டல்", placements: "வேலை வாய்ப்புகள்", courseOfferings: "பாடப்பிரிவுகள்", studentLife: "மாணவர் வாழ்க்கை", researchPrograms: "ஆராய்ச்சி திட்டங்கள்", alumniNetwork: "பழைய மாணவர் வலையமைப்பு", academicCalendar: "கல்வி காலண்டர்", libraryResources: "நூலக வளங்கள்", sportsFacilities: "விளையாட்டு வசதிகள்", healthServices: "சுகாதார சேவைகள்" }
        },
        te: {
            welcome: "SRM ఇన్ఫోబాట్ - మీ 24/7 విశ్వవిద్యాలయ సహాయకుడు",
            placeholder: "SRM విశ్వవిద్యాలయం గురించి ఏదైనా అడగండి...",
            // ... other 'te' translations
            suggestions: { admissionProcess: "ప్రవేశ విధానం", campusLife: "క్యాంపస్ జీవితం", academicPortal: "విద్యా పోర్టల్", placements: "ప్లేస్‌మెంట్స్", courseOfferings: "కోర్స్ ఆఫర్లు", studentLife: "విద్యార్థి జీవితం", researchPrograms: "పరిశోధన కార్యక్రమాలు", alumniNetwork: "పూర్వ విద్యార్థుల నెట్‌వర్క్", academicCalendar: "విద్యా క్యాలెండర్", libraryResources: "లైబ్రరీ వనరులు", sportsFacilities: "క్రీడా సౌకర్యాలు", healthServices: "ఆరోగ్య సేవలు" }
        },
        ml: {
            welcome: "SRM ഇൻഫോബോട്ട് - നിങ്ങളുടെ 24/7 യൂണിവേഴ്സിറ്റി അസിസ്റ്റന്റ്",
            placeholder: "SRM സർവകലാശാലയെക്കുറിച്ച് എന്തെങ്കിലും ചോദിക്കൂ...",
            // ... other 'ml' translations
            suggestions: { admissionProcess: "പ്രവേശന നടപടിക്രമം", campusLife: "ക്യാമ്പസ് ജീവിതം", academicPortal: "അക്കാദമിക് പോർട്ടൽ", placements: "പ്ലേസ്‌മെന്റുകൾ", courseOfferings: "കോഴ്‌സ് ഓഫറുകൾ", studentLife: "വിദ്യാർത്ഥി ജീവിതം", researchPrograms: "ഗവേഷണ പരിപാടികൾ", alumniNetwork: "പൂർവ്വ വിദ്യാർത്ഥി ശൃംഖല", academicCalendar: "അക്കാദമിക് കലണ്ടർ", libraryResources: "ലൈബ്രറി വിഭവങ്ങൾ", sportsFacilities: "കായിക സൗകര്യങ്ങൾ", healthServices: "ആരോഗ്യ സേവനങ്ങൾ" }
        }
    };

    // === Keywords & Predefined Data (Keep as is) ===
    const srmKeywords = [ /* ... keep your extensive list ... */ 'srm hospital', 'medical center', 'health service' ];
    const conversationPatterns = { /* ... keep as is ... */ };
    const srmPredefinedAnswers = { /* ... keep as is ... */ };
    const allSuggestionsTexts = [ /* ... keep your list of suggestion texts ... */ ]; // Used for autocomplete


    // === Core Functions ===

    // Update UI Language
    function updateUILanguage(lang) {
        currentLanguage = lang;
        if (!translations[lang]) {
            console.error("Language not found in translations:", lang);
            return;
        }
        inputElement.placeholder = translations[lang].placeholder;
        disclaimerText.textContent = translations[lang].welcome;

        // Update static suggestions based on matching English text
        document.querySelectorAll('.suggestion .text').forEach(suggestionSpan => {
            const originalEnglishText = suggestionSpan.getAttribute('data-original-text');
            const suggestionKey = Object.keys(translations.en.suggestions).find(
                key => translations.en.suggestions[key] === originalEnglishText
            );

            if (suggestionKey && translations[lang].suggestions[suggestionKey]) {
                suggestionSpan.textContent = translations[lang].suggestions[suggestionKey];
            } else {
                // Fallback if no translation found
                 suggestionSpan.textContent = originalEnglishText;
            }
        });
         // Optionally update any dynamically added elements or notifications if needed
    }

    // Show Welcome Notification
    const showWelcomeNotification = () => {
        // Prevent creating multiple notifications
        if (document.querySelector('.notification-popup#bot-welcome-notification')) {
            return;
        }

        const notification = document.createElement('div');
        notification.id = 'bot-welcome-notification'; // Specific ID for welcome notification
        notification.className = 'notification-popup'; // Base class for styling & positioning
        notification.innerHTML = `
            <span class="bot-icon material-symbols-rounded">smart_toy</span>
            <div class="notification-content">
                <div class="notification-title">SRM InfoBot</div>
                <div class="notification-message">👋 Hi! I'm here to help. Ask me anything about SRM!</div>
            </div>
            <button class="close-btn icon-button material-symbols-rounded" type="button" aria-label="Close notification">close</button>
        `; // Using button, added aria-label

        document.body.appendChild(notification);

        // --- Function to handle removing the notification ---
        const removeNotification = () => {
            // Check if the element still exists in the DOM before removal
            if (notification.parentNode) {
                notification.remove();
            }
        };

        // --- Close Button Logic ---
        const closeBtn = notification.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // 1. Start the slide-out animation by removing .show
                notification.classList.remove('show');
                // 2. Wait for the CSS transition to finish, then remove from DOM
                notification.addEventListener('transitionend', removeNotification, { once: true });
            });
        } else {
            console.error("Close button could not be found in notification template.");
        }

        // --- Slide In Animation ---
        // We need a slight delay after appending for the browser to register the initial state
        // Using requestAnimationFrame helps ensure the element is ready before starting the transition
        requestAnimationFrame(() => {
            setTimeout(() => {
                notification.classList.add('show'); // Add .show to trigger the slide-in
            }, 50); // Very short delay (50ms) usually suffices
        });


        // --- Auto Hide Logic ---
        const autoHideDelay = 6000; // Auto-hide after 6 seconds
        const autoHideTimeout = setTimeout(() => {
            // Check if the notification is still visible (might have been closed manually)
            if (notification.classList.contains('show')) {
                notification.classList.remove('show'); // Start slide-out
                notification.addEventListener('transitionend', removeNotification, { once: true }); // Remove after transition
            }
        }, autoHideDelay);

        // If closed manually, clear the auto-hide timer
        if (closeBtn) {
            closeBtn.addEventListener('click', () => clearTimeout(autoHideTimeout), { once: true });
        }
    };
    

    // Create Message Element
    const createMessageElement = (content, className) => {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", className); // e.g., "incoming" or "outgoing"
        messageDiv.innerHTML = content;
        return messageDiv;
    };

    // Copy Message to Clipboard
    const copyMessage = (copyBtn) => {
        // Find the sibling '.message-content' then the '.text' inside it
        const messageContent = copyBtn.closest('.message')?.querySelector(".message-content");
        const messageText = messageContent?.querySelector(".text")?.innerText; // Use innerText to get displayed text

        if (messageText) {
            navigator.clipboard.writeText(messageText)
                .then(() => {
                    copyBtn.textContent = "done"; // Feedback icon
                    setTimeout(() => copyBtn.textContent = "content_copy", 1500);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        } else {
            console.error("Could not find text to copy.");
        }
    };
    // Make copyMessage globally accessible for the inline onclick
    window.copyMessage = copyMessage;

    // Process Simple Queries (Greetings, Farewells, Help, specific keywords)
    const processSimpleQuery = (query) => {
        query = query.toLowerCase().trim();

        if (conversationPatterns.greetings.some(greeting => query.includes(greeting))) {
            const greetings = { en: "Hello! 👋 How can I assist you with SRM University today?", ta: "வணக்கம்! 👋 இன்று SRM பல்கலைக்கழகம் குறித்து நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?", te: "నమస్కారం! 👋 ఈ రోజు SRM విశ్వవిద్యాలయం గురించి నేను మీకు ఎలా సహాయపడగలను?", ml: "നമസ്കാരം! 👋 ഇന്ന് എസ്ആർഎം യൂണിവേഴ്സിറ്റിയുമായി ബന്ധപ്പെട്ട് എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാൻ കഴിയും?" };
            return greetings[currentLanguage] || greetings.en;
        }
        if (conversationPatterns.farewells.some(farewell => query.includes(farewell))) {
            const farewells = { en: "Thank you! Have a great day! 😊", ta: "நன்றி! ஒரு சிறந்த நாள் வாழ்த்துக்கள்! 😊", te: "ధన్యవాదాలు! శుభదినం! 😊", ml: "നന്ദി! ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു! 😊" };
            return farewells[currentLanguage] || farewells.en;
        }
        if (conversationPatterns.help.some(helpWord => query.includes(helpWord))) {
            const helpText = {en: "I can help with Admissions, Courses, Campus Life, Placements, Fees, and more about SRM. What specific information are you looking for?", /* Add other languages */};
            return helpText[currentLanguage] || helpText.en;
        }
        // Check predefined answers (using the existing srmPredefinedAnswers object)
        const predefined = checkPredefinedAnswer(query, currentLanguage);
        if(predefined) return predefined;

        return null; // No simple response found
    };

     // Check if there is a predefined answer
     const checkPredefinedAnswer = (message, lang = 'en') => {
        const lowerMessage = message.toLowerCase();
        // Ensure the language exists in the predefined answers
        if (!srmPredefinedAnswers[lang]) lang = 'en';

        // Check against keys (like 'admissions', 'placements')
        for (const key in srmPredefinedAnswers[lang]) {
            // Check if the key itself or related words are in the message
            if (lowerMessage.includes(key.toLowerCase()) || (key === 'campus' && lowerMessage.includes('life')) || (key === 'hospital' && (lowerMessage.includes('medical') || lowerMessage.includes('health')))) {
                return srmPredefinedAnswers[lang][key];
            }
        }
         // Add more specific checks if needed
         if (lowerMessage.includes("fee structure")) return srmPredefinedAnswers[lang].feesStructure || "Please specify the course for fee details.";

        return null;
    };


    // Format Bot Response Text
    const formatBotResponse = (response) => {
        // Basic cleanup: remove extra asterisks, maybe excessive newlines
        response = response.replace(/\*{2,}/g, '*'); // Replace multiple * with single
        response = response.replace(/#/g, '');     // Remove #
        // Convert markdown-like lists to line breaks (simple version)
        response = response.replace(/^\s*[\-\*]\s+/gm, '\n • '); // Basic list conversion
        response = response.replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
        return response.trim();
    };

    // Show Typing Effect
    const showTypingEffect = (text, textElement, messageDiv) => {
        if (!textElement) {
            console.error("Target text element not found for typing effect.");
            isResponseGenerating = false; // Reset flag
            return;
        }

        isTypingPaused = false;
        const formattedText = formatBotResponse(text); // Format the final text
        // Split into words for a more natural typing feel
        const words = formattedText.split(/(\s+)/); // Split by space, keeping spaces
        let currentWordIndex = 0;
        textElement.innerHTML = ''; // Clear previous content (like "Bot is thinking...")
        messageDiv.classList.remove("loading"); // Remove loading class visually

        // Set button to pause icon if response generation just started
        if (isResponseGenerating) {
             sendButton.textContent = "pause";
             sendButton.disabled = false; // Ensure button is enabled
        }

        clearInterval(currentTypingInterval); // Clear any previous interval

        currentTypingInterval = setInterval(() => {
            if (isTypingPaused) return; // Skip if paused

            if (currentWordIndex < words.length) {
                // Append word/space
                textElement.innerHTML += words[currentWordIndex];
                currentWordIndex++;
                chatList.scrollTop = chatList.scrollHeight; // Scroll to bottom
            } else {
                // Typing finished
                clearInterval(currentTypingInterval);
                currentTypingInterval = null;
                isResponseGenerating = false;
                messageDiv.classList.remove("loading"); // Ensure loading class is removed

                // Restore send button to 'send' icon
                sendButton.textContent = "send";
                 sendButton.disabled = false; // Ensure button is enabled

                // Show copy button if it exists
                const copyButton = messageDiv.querySelector(".icon.material-symbols-rounded"); // More specific selector
                if (copyButton) copyButton.classList.remove("hide");

                // Save chat history
                localStorage.setItem("savedChats", chatList.innerHTML);

                 // --- Contextual Suggestions (Currently Commented Out) ---
                // displayContextualSuggestions(messageDiv, userMessage); // Pass original user message
                // ---------------------------------------------------------
            }
        }, 1000 / TYPING_SPEED_FACTOR / 5); // Adjust timing (e.g., / 5 for word speed)
    };

    // Pause/Resume Typing Effect
    const pauseResumeResponse = () => {
        if (!isResponseGenerating || !currentTypingInterval) return; // Only act if typing

        if (isTypingPaused) {
            sendButton.textContent = "pause";
            isTypingPaused = false;
        } else {
            sendButton.textContent = "play_arrow"; // Show play icon when paused
            isTypingPaused = true;
            // Don't clear interval, just pause execution inside it
        }
    };

    // --- Contextual Suggestions (Commented Out - Requires HTML/CSS) ---
    /*
    const generateContextualSuggestions = (query) => {
        // ... (Keep your logic here) ...
        const lowerQuery = query.toLowerCase();
        let suggestions = [];
        // Example:
        if (lowerQuery.includes("admission")) {
            suggestions.push("Eligibility Criteria?", "Application Deadline?", "Required Documents?");
        }
        // ... add more rules ...

        // Fallback suggestions
        const fallback = ["Campus Tour?", "Hostel Facilities?", "Library Timings?"];
        while (suggestions.length < 3 && fallback.length > 0) {
            suggestions.push(fallback.shift());
        }
        return suggestions.slice(0, 3); // Max 3 suggestions
    };

    const displayContextualSuggestions = (messageDiv, query) => {
        const suggestionsContainer = messageDiv.querySelector("#contextual-suggestions-container"); // Needs this ID in the template
        if (!suggestionsContainer) return;

        const suggestions = generateContextualSuggestions(query);
        const suggestionList = suggestionsContainer.querySelector("ul"); // Assuming ul inside the container
        if (!suggestionList) return;

        suggestionList.innerHTML = ""; // Clear previous

        if (suggestions.length === 0) {
            suggestionsContainer.style.display = 'none'; // Hide if no suggestions
            return;
        }

        suggestionsContainer.style.display = 'block'; // Show container
        suggestions.forEach(suggestionText => {
            const listItem = document.createElement("li");
            listItem.textContent = suggestionText;
            listItem.classList.add("contextual-suggestion"); // Add class for styling
            listItem.addEventListener("click", () => {
                inputElement.value = suggestionText; // Put suggestion in input
                handleOutgoingChat(); // Send it
            });
            suggestionList.appendChild(listItem);
        });
    };
    */
    // --------------------------------------------------------------------

    // Generate Response (Simple or API)
    const generateResponse = async (incomingMessageDiv) => {
        const textElement = incomingMessageDiv.querySelector(".text");

        if (!userMessage) {
            showTypingEffect("Sorry, I didn't get that. Could you please rephrase?", textElement, incomingMessageDiv);
            return;
        }

        // 1. Try Simple Response / Predefined Answers
        const simpleResponse = processSimpleQuery(userMessage);
        if (simpleResponse) {
            showTypingEffect(simpleResponse, textElement, incomingMessageDiv);
             // Update conversation history for simple responses too
             conversationHistory.push({ role: "model", content: simpleResponse });
             if (conversationHistory.length > MAX_HISTORY_LENGTH * 2) { // Keep history balanced
                 conversationHistory.splice(0, 2);
             }
            return; // Don't proceed to API if simple response is found
        }

        // 2. Try Knowledge Base (Flask API)
        let knowledgeBaseResponse = null;
        try {
            const kbResponse = await fetch(`${FLASK_BASE_URL}/api/query-knowledge-base`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMessage, language: currentLanguage })
            });
            if (kbResponse.ok) {
                const kbData = await kbResponse.json();
                if (kbData && kbData.response) {
                     knowledgeBaseResponse = kbData.response;
                     // Clean response: replace newlines for display, remove markdown
                     //const formattedResponse = knowledgeBaseResponse.replace(/\n/g, '<br>').replace(/[#*]/g, '');
                     showTypingEffect(knowledgeBaseResponse, textElement, incomingMessageDiv); // Use raw response for typing effect
                     // Update history
                     conversationHistory.push({ role: "model", content: knowledgeBaseResponse });
                     if (conversationHistory.length > MAX_HISTORY_LENGTH * 2) conversationHistory.splice(0, 2);
                     return; // Don't proceed to Gemini if KB answered
                 }
            }
        } catch (error) {
            console.warn("Knowledge base request failed or returned no answer:", error);
            // Continue to Gemini API
        }


        // 3. Fallback to Gemini API
        // Format conversation history for the API
        const apiHistory = conversationHistory.map(turn => ({
            role: turn.role === 'user' ? 'user' : 'model', // Ensure role names match API spec
            parts: [{ text: turn.content }]
        })).slice(-MAX_HISTORY_LENGTH * 2); // Send last N turns

         // Construct the prompt carefully
         const currentPrompt = `Considering the conversation history, answer the user's latest query about SRM University: "${userMessage}". Provide the answer in ${translations[currentLanguage]?.languageName || 'English'}. Focus on factual information relevant to SRM.`;

        const apiBody = {
            contents: [
                ...apiHistory, // Include formatted history
                { // Add the current user query
                    role: "user",
                    parts: [{ text: currentPrompt }]
                }
            ],
             // Add safety settings and generation config if needed
             // generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
             // safetySettings: [ ... ]
        };


        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(apiBody)
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 console.error("API Error Response:", errorData);
                 throw new Error(`API request failed with status ${response.status}`);
             }

            const data = await response.json();

            // Extract text response - Check candidate structure
            let apiResponse = "Sorry, I couldn't generate a response."; // Default
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                apiResponse = data.candidates[0].content.parts[0].text.trim();
            } else {
                console.warn("Unexpected API response structure:", data);
            }

            showTypingEffect(apiResponse, textElement, incomingMessageDiv);
             // Update history with Gemini's response
             conversationHistory.push({ role: "model", content: apiResponse });
             if (conversationHistory.length > MAX_HISTORY_LENGTH * 2) conversationHistory.splice(0, 2);

        } catch (error) {
            console.error("Error fetching from Gemini API:", error);
            const errorMessages = {
                en: "Apologies, I'm encountering a technical issue. Please try again later.",
                ta: "மன்னிக்கவும், தொழில்நுட்ப சிக்கல் ஏற்பட்டுள்ளது. பின்னர் மீண்டும் முயற்சிக்கவும்.",
                te: "క్షమించండి, సాంకేతిక సమస్య ఎదురైంది. దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి.",
                ml: "ക്ഷമിക്കണം, ഒരു സാങ്കേതിക പ്രശ്നം നേരിടുന്നു. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
            };
            showTypingEffect(errorMessages[currentLanguage] || errorMessages.en, textElement, incomingMessageDiv);
            textElement.classList.add("error"); // Add error class for styling
        }
    };

    // Handle Outgoing Chat Message
    const handleOutgoingChat = () => {
        userMessage = inputElement.value.trim(); // Get message from textarea
        if (!userMessage || isResponseGenerating) return; // Do nothing if empty or already generating

        isResponseGenerating = true; // Set flag
        sendButton.disabled = true; // Disable send while processing initial step
        sendButton.textContent = 'pause'; // Show pause icon immediately


        // 1. Create and display the user's message bubble
        const userHtml = `
            <div class="message-content">
                <img src="images/user.jpg" alt="User" class="avatar">
                <p class="text">${userMessage}</p>
            </div>
        `;
        const outgoingMessageDiv = createMessageElement(userHtml, "outgoing");
        chatList.appendChild(outgoingMessageDiv);
        chatList.scrollTop = chatList.scrollHeight; // Scroll down

        // 2. Clear input and update history
        inputElement.value = '';
        inputElement.style.height = 'auto'; // Reset height after sending
        autocompleteList.innerHTML = ""; // Clear autocomplete
        autocompleteList.style.display = "none";
        conversationHistory.push({ role: "user", content: userMessage });
        if (conversationHistory.length > MAX_HISTORY_LENGTH * 2) {
            conversationHistory.shift(); // Keep history trimmed (user message)
        }
        // Track query frequency if needed
        queryFrequency[userMessage] = (queryFrequency[userMessage] || 0) + 1;

        // 3. Show loading/thinking indicator for the bot
        setTimeout(showBotLoadingAndGenerate, 300); // Short delay before showing loading
    };

    // Show Bot Loading and Trigger Response Generation
    const showBotLoadingAndGenerate = () => {
        const botHtml = `
            <div class="message-content">
                <img src="images/gemini.svg" alt="Bot" class="avatar">
                <div class="loading-indicator"> <!-- Loading bars shown initially -->
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                </div>
                <p class="text"></p> <!-- Text element for typing effect -->
            </div>
            <!-- Add copy button, hidden initially -->
            <span class="icon material-symbols-rounded hide" onclick="copyMessage(this)">content_copy</span>

             <!-- Contextual Suggestions Placeholder (Commented out) -->
             <!--
             <div id="contextual-suggestions-container" style="display: none;">
                 <h5>Related Questions:</h5>
                 <ul class="suggestion-list"></ul>
             </div>
             -->
        `;
        const incomingMessageDiv = createMessageElement(botHtml, "incoming loading"); // Add 'loading' class
        chatList.appendChild(incomingMessageDiv);
        chatList.scrollTop = chatList.scrollHeight;

        // 4. Start generating the actual response
        generateResponse(incomingMessageDiv);
    };

    // --- Suggestion Group Management (Using active class) ---
    const setActiveSuggestionGroup = (groupNumber) => {
        currentSuggestionGroup = groupNumber;
        suggestionContainers.forEach((container, index) => {
            if (index + 1 === groupNumber) {
                container.classList.add('active'); // Show this group
            } else {
                container.classList.remove('active'); // Hide others
            }
        });
        updateSuggestionButtonVisibility(); // Update button states
    };

    const updateSuggestionButtonVisibility = () => {
        scrollUpButton.disabled = currentSuggestionGroup === 1;
        scrollDownButton.disabled = currentSuggestionGroup === suggestionContainers.length; // Disable if on last group
        // Optional: Add visual styling for disabled state via CSS [disabled] selector
         scrollUpButton.style.opacity = scrollUpButton.disabled ? '0.5' : '1';
         scrollDownButton.style.opacity = scrollDownButton.disabled ? '0.5' : '1';
    };
    //-----------------------------------------------------------

    // Autocomplete Suggestions Display
    const displayAutocompleteSuggestions = (suggestions) => {
        if (!autocompleteList) return; // Safety check

        autocompleteList.innerHTML = ""; // Clear previous

        if (suggestions.length === 0 || !inputElement.value.trim()) {
            autocompleteList.style.display = "none";
            return;
        }

        suggestions.slice(0, 5).forEach(suggestion => { // Show max 5 suggestions
            const listItem = document.createElement("li");
            listItem.textContent = suggestion;
            listItem.classList.add("autocomplete-item"); // Add class for styling
            listItem.addEventListener("click", () => {
                inputElement.value = suggestion; // Fill input on click
                autocompleteList.innerHTML = ""; // Clear list
                autocompleteList.style.display = "none";
                inputElement.focus(); // Keep focus on input
            });
            autocompleteList.appendChild(listItem);
        });

        autocompleteList.style.display = "block";
    };

     // Auto-resize textarea
     const autoResizeTextarea = () => {
         inputElement.style.height = 'auto'; // Reset height
         // Set height based on scroll height, capped by max-height from CSS
         const maxHeight = parseInt(window.getComputedStyle(inputElement).maxHeight, 10) || 120;
         inputElement.style.height = `${Math.min(inputElement.scrollHeight, maxHeight)}px`;
     };

    // === Event Listeners ===

    // Typing Form Submission (Enter Key)
    typingForm.addEventListener("submit", (e) => {
        e.preventDefault(); // Prevent default form submission
        handleOutgoingChat();
    });

    // Send Button Click
    sendButton.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission if button is clicked
        if (sendButton.textContent === "pause" || sendButton.textContent === "play_arrow") {
            pauseResumeResponse();
        } else if (sendButton.textContent === "send") {
            handleOutgoingChat();
        }
    });

     // Textarea Input for Auto-Resize and Autocomplete
     inputElement.addEventListener("input", () => {
         autoResizeTextarea();
         // Autocomplete logic
         const inputText = inputElement.value.toLowerCase().trim();
         if (inputText) {
             const filtered = allSuggestionsTexts.filter(s => s.toLowerCase().includes(inputText));
             displayAutocompleteSuggestions(filtered);
         } else {
             displayAutocompleteSuggestions([]); // Clear suggestions if input is empty
         }
     });

     // Clear autocomplete when input loses focus (optional)
     inputElement.addEventListener("blur", () => {
         // Delay hiding to allow click on suggestion item
         setTimeout(() => {
             if (autocompleteList) {
                 autocompleteList.innerHTML = "";
                 autocompleteList.style.display = "none";
             }
         }, 150);
     });


    // Suggestion Navigation Buttons
    scrollUpButton.addEventListener('click', () => {
        if (currentSuggestionGroup > 1) {
            setActiveSuggestionGroup(currentSuggestionGroup - 1);
        }
    });

    scrollDownButton.addEventListener('click', () => {
        if (currentSuggestionGroup < suggestionContainers.length) {
            setActiveSuggestionGroup(currentSuggestionGroup + 1);
        }
    });

    // Clicking on a Suggestion Item
    document.querySelectorAll('.suggestion').forEach(suggestion => {
        suggestion.addEventListener("click", () => {
            const text = suggestion.querySelector(".text")?.textContent?.trim();
             if (text) {
                 // Use the clicked text directly or map specific ones
                 userMessage = text === "Health Services"
                               ? "Tell me about SRM Hospital and its medical services"
                               : text;
                 inputElement.value = userMessage; // Put in input box as well
                 handleOutgoingChat(); // Trigger chat submission
            }
        });
    });

    // Theme Toggle
    toggleThemeButton.addEventListener("click", () => {
        const isLightMode = document.body.classList.toggle("light-mode"); // Use a descriptive class name
        localStorage.setItem("theme", isLightMode ? "light" : "dark");
        // Update icon based on the current theme
        toggleThemeButton.textContent = isLightMode ? "dark_mode" : "light_mode";
    });

    // Delete Chat
    deleteChatButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all messages?")) {
            localStorage.removeItem("savedChats");
            chatList.innerHTML = "";
            document.body.classList.remove("hide-header");
        }
    });

    // Language Selection
    languageSelect.addEventListener('change', (e) => {
        updateUILanguage(e.target.value);
    });

    // ========================= Initialization =========================
    setActiveSuggestionGroup(1);
    console.log("Attempting to show welcome notification...");
    //showGroup(1);
    //updateButtonVisibility();
    showWelcomeNotification();
});

// Make copyMessage accessible globally
window.copyMessage = copyMessage;

// Network Event Listeners for debugging
window.addEventListener('offline', () => {
    console.error('Network connection lost. Please check your internet connection.');
});

window.addEventListener('online', () => {
    console.log('Network connection restored.');
});
