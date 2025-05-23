// script1-js.js

document.addEventListener('DOMContentLoaded', () => {
    // === Constants ===
    const FLASK_BASE_URL = 'http://localhost:5000'; // Replace if different
    const API_KEY = "AIzaSyDAK3gTEiJFynqHm7-jvrL-ePM_YoHHbpM";
    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
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
    let isPaused = false;
    
    // === Event Listeners (Add this helper function) ===
    const stopCurrentTypingAndReset = () => {
        console.log("--- stopCurrentTypingAndReset: STARTED ---"); // Log entry
    
        // Log state BEFORE attempting changes
        console.log(`stopCurrentTypingAndReset: Current isResponseGenerating = ${isResponseGenerating}`);
        console.log(`stopCurrentTypingAndReset: Current interval ID = ${currentTypingInterval}`);
    
        if (currentTypingInterval) {
            console.log(`stopCurrentTypingAndReset: Attempting to clear interval ID: ${currentTypingInterval}`);
            try {
                clearInterval(currentTypingInterval);
                console.log(`stopCurrentTypingAndReset: Successfully called clearInterval.`);
            } catch (error) {
                console.error(`stopCurrentTypingAndReset: Error during clearInterval:`, error);
            } finally {
                 // ALWAYS nullify the interval variable after attempting to clear
                 currentTypingInterval = null;
                 console.log(`stopCurrentTypingAndReset: Set currentTypingInterval to null.`);
            }
        } else {
            console.warn("stopCurrentTypingAndReset: No active typing interval ID found to clear.");
            // If there's no interval, maybe isResponseGenerating is still true? Force reset?
            if (isResponseGenerating) {
                console.warn("stopCurrentTypingAndReset: isResponseGenerating was true but no interval found. Forcing state reset anyway.");
            }
        }
        console.trace("Who cleared the interval?");

    
        // Find the last incoming message which might still be "loading"
        const lastMessage = chatList.querySelector('.message.incoming:last-child');
        if (lastMessage && lastMessage.classList.contains('loading')) {
            lastMessage.classList.remove('loading');
            // Optionally add text indicating it was stopped, or just leave it partially typed
            const textElement = lastMessage.querySelector('.text');
            if (textElement && !textElement.textContent?.trim()) {
                 textElement.textContent = "[Response stopped]"; // Example placeholder
            }
            console.log("stopCurrentTypingAndReset: Removed loading class from last message.");
        } else {
             console.log("stopCurrentTypingAndReset: Did not find a loading incoming message to update.");
        }
    
        // --- Reset state flags ---
        isResponseGenerating = false; // Set the main flag to false
        if (!isResponseGenerating) return; // Already reset

        console.log(`stopCurrentTypingAndReset: Set isResponseGenerating = ${isResponseGenerating}`); // Verify it's false
    
        // --- Reset button appearance and enable it ---
        sendButton.textContent = "send";
        sendButton.disabled = false;
        console.log(`stopCurrentTypingAndReset: Set button text to '${sendButton.textContent}', disabled = ${sendButton.disabled}`); // Verify changes
    
        // Save chat history - state might have changed (e.g., partial message)
        localStorage.setItem("savedChats", chatList.innerHTML);
        console.log("--- stopCurrentTypingAndReset: FINISHED ---"); // Log exit
    };
    
    // Helper function to handle suggestion clicks
    const handleSuggestionClick = (clickedSuggestionElement) => {
        // Get the text *currently displayed* in the suggestion
        const currentText = clickedSuggestionElement.querySelector(".text")?.textContent?.trim();
        if (!currentText) {
            console.warn("Could not get text from clicked suggestion:", clickedSuggestionElement);
            return;
        }

        console.log(`Suggestion clicked: "${currentText}"`); // Log clicked text

        // --- Determine the base query ---
        // Find the English text using the data-original-text attribute
        const originalEnglishText = clickedSuggestionElement.getAttribute('data-original-text');

        // Map specific suggestions if needed (like Health Services)
        if (originalEnglishText === "Health Services") {
           userMessage = "Tell me about SRM Hospital and its medical services";
           console.log("Mapping 'Health Services' to query:", userMessage);
        } else {
           // Use the original English text as the base query for consistency,
           // or use the current displayed text if preferred.
           // Using originalEnglishText is often better for backend processing.
           userMessage = originalEnglishText || currentText; // Fallback to current text if attribute is missing
           console.log("Using suggestion text as query:", userMessage);
        }

        inputElement.value = currentText; // Put the *displayed* text in the input box for user visibility
        handleOutgoingChat(); // Trigger chat submission
   };

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
        },
        hi: {
            welcome: "SRM इन्फोबॉट - आपका 24/7 विश्वविद्यालय सहायक",
            placeholder: "SRM विश्वविद्यालय के बारे में कुछ भी पूछें...",
            suggestions: {
                admissionProcess: "प्रवेश प्रक्रिया", campusLife: "कैंपस जीवन", academicPortal: "अकादमिक पोर्टल", placements: "प्लेसमेंट",
                courseOfferings: "पाठ्यक्रम प्रस्ताव", studentLife: "छात्र जीवन", researchPrograms: "अनुसंधान कार्यक्रम", alumniNetwork: "पूर्व छात्र नेटवर्क",
                academicCalendar: "अकादमिक कैलेंडर", libraryResources: "पुस्तकालय संसाधन", sportsFacilities: "खेल सुविधाएं", healthServices: "स्वास्थ्य सेवाएं"
            }
        }
    };

    // === Keywords & Predefined Data (Keep as is) ===
    const srmKeywords = [ 'srm', 'university', 'college', 'campus', 'department', 'faculty',
    'course', 'program', 'semester', 'academic', 'study', 'research',
    'lecture', 'class', 'laboratory', 'lab', 'library', 'examination',
    'exam', 'test', 'assignment', 'project', 'grade', 'result',
    'attendance', 'syllabus', 'curriculum', 'timetable', 'schedule',
    'admission', 'application', 'enrollment', 'registration', 'fee',
    'scholarship', 'financial aid', 'document', 'certificate',
    'eligibility', 'criteria', 'requirement', 'deadline', 'payment',
    'hostel', 'accommodation', 'dormitory', 'cafeteria', 'canteen',
    'mess', 'food', 'transport', 'bus', 'shuttle', 'parking',
    'security', 'facility', 'amenity', 'infrastructure', 'wifi',
    'internet', 'lab', 'equipment', 'sports', 'gym', 'fitness',
    'student', 'staff', 'faculty', 'teacher', 'professor', 'dean',
    'advisor', 'counselor', 'mentor', 'support', 'help', 'guidance',
    'office', 'department', 'administration', 'management',
    'placement', 'career', 'internship', 'job', 'recruitment',
    'company', 'industry', 'corporate', 'salary', 'package',
    'interview', 'training', 'skill', 'development',
    'hospital', 'health', 'medical', 'clinic', 'healthcare', 'emergency',
    'doctor', 'physician', 'ambulance', 'pharmacy', 'medicine', 'treatment',
    'srm hospital', 'medical center', 'health service', 'health care',
    'medical facility', 'emergency care', 'outpatient', 'inpatient','srm hospital', 'medical center', 'health service' ];
    const conversationPatterns = { greetings: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
        farewells: ['bye', 'goodbye', 'see you', 'thank you', 'thanks'],
        help: ['help', 'assist', 'support', 'guide', 'what can you do', 'how can you help'] };
    const srmPredefinedAnswers = {  en: {
        admissions: `SRM University admissions process involves:
- Online application through the SRM website
- Entrance exam (SRMJEEE)
- Merit-based selection
- Document verification
- Fee payment to confirm admission
- Orientation program before classes begin`,

        placements: `SRM University has an excellent placement record:
- 85%+ placement rate across programs
- 600+ companies visit campus annually
- Average package of 5-6 LPA
- Top recruiters include Microsoft, Amazon, IBM, TCS
- Pre-placement training provided
- Dedicated placement cell for student support`,

        campus: `SRM University campus features:
- Modern classrooms with smart technology
- Well-equipped laboratories
- Central library with digital resources
- Multiple hostels for boys and girls
- Food courts and cafeterias
- Sports facilities including swimming pool
- Wi-Fi enabled campus
- Medical center for healthcare`,

        hospital: `SRM Hospital is a state-of-the-art medical facility that provides:
- 24/7 emergency medical services
- Outpatient and inpatient care
- Advanced diagnostic facilities
- Specialized departments for various medical needs
- Well-equipped pharmacy
- Ambulance services
- Regular health check-up camps
- Modern operation theaters
- Qualified medical professionals and staff`
    },
    ta: {
        admissions: `SRM பல்கலைக்கழக சேர்க்கை செயல்முறையில் அடங்கும்:
- SRM இணையதளம் மூலம் ஆன்லைன் விண்ணப்பம்
- நுழைவுத் தேர்வு (SRMJEEE)
- தகுதி அடிப்படையிலான தேர்வு
- ஆவண சரிபார்ப்பு
- சேர்க்கையை உறுதிப்படுத்த கட்டணம் செலுத்துதல்
- வகுப்புகள் தொடங்குவதற்கு முன் அறிமுக நிகழ்ச்சி`,

        placements: `SRM பல்கலைக்கழகம் சிறந்த வேலைவாய்ப்பு பதிவைக் கொண்டுள்ளது:
- அனைத்து திட்டங்களிலும் 85%+ வேலைவாய்ப்பு விகிதம்
- ஆண்டுதோறும் 600+ நிறுவனங்கள் வளாகத்திற்கு வருகை
- சராசரி பேக்கேஜ் 5-6 LPA
- முன்னணி நிறுவனங்களில் Microsoft, Amazon, IBM, TCS போன்றவை அடங்கும்
- வேலைவாய்ப்புக்கு முந்தைய பயிற்சி வழங்கப்படுகிறது
- மாணவர் ஆதரவுக்கான அர்ப்பணிப்புள்ள வேலைவாய்ப்பு பிரிவு`,

        campus: `SRM பல்கலைக்கழக வளாகத்தில் உள்ளவை:
- நவீன தொழில்நுட்பத்துடன் கூடிய நவீன வகுப்பறைகள்
- நன்கு வசதிகள் கொண்ட ஆய்வகங்கள்
- டிஜிட்டல் வளங்களுடன் கூடிய மைய நூலகம்
- ஆண், பெண் இருவருக்கும் பல விடுதிகள்
- உணவு அரங்குகள் மற்றும் கஃபேட்டீரியாக்கள்
- நீச்சல் குளம் உட்பட விளையாட்டு வசதிகள்
- வை-ஃபை செயல்படுத்தப்பட்ட வளாகம்
- சுகாதார பராமரிப்புக்கான மருத்துவ மையம்`,

        hospital: `SRM மருத்துவமனை ஒரு நவீன மருத்துவ வசதியாகும்:
- 24/7 அவசர மருத்துவ சேவைகள்
- வெளிநோயாளி மற்றும் உள்நோயாளி பராமரிப்பு
- மேம்பட்ட நோயறிதல் வசதிகள்
- பல்வேறு மருத்துவ தேவைகளுக்கான சிறப்பு துறைகள்
- நன்கு வசதி கொண்ட மருந்தகம்
- ஆம்புலன்ஸ் சேவைகள்
- வழக்கமான உடல்நல பரிசோதனை முகாம்கள்
- நவீன அறுவை சிகிச்சை அரங்குகள்
- தகுதி வாய்ந்த மருத்துவ நிபுணர்கள் மற்றும் ஊழியர்கள்`
    },
    te: {
        admissions: `SRM విశ్వవిద్యాలయ ప్రవేశ ప్రక్రియలో ఉన్నవి:
- SRM వెబ్‌సైట్ ద్వారా ఆన్‌లైన్ దరఖాస్తు
- ప్రవేశ పరీక్ష (SRMJEEE)
- మెరిట్ ఆధారిత ఎంపిక
- డాక్యుమెంట్ వెరిఫికేషన్
- ప్రవేశాన్ని నిర్ధారించడానికి ఫీజు చెల్లింపు
- తరగతులు ప్రారంభానికి ముందు ఓరియంటేషన్ ప్రోగ్రామ్`,

        placements: `SRM విశ్వవిద్యాలయానికి ఉత్తమమైన ప్లేస్‌మెంట్ రికార్డు ఉంది:
- అన్ని ప్రోగ్రాముల్లో 85%+ ప్లేస్‌మెంట్ రేటు
- సంవత్సరానికి 600+ కంపెనీలు క్యాంపస్‌కు వస్తాయి
- సగటు ప్యాకేజీ 5-6 LPA
- టాప్ రిక్రూటర్లలో Microsoft, Amazon, IBM, TCS వంటివి ఉన్నాయి
- ప్రీ-ప్లేస్‌మెంట్ ట్రైనింగ్ అందించబడుతుంది
- విద్యార్థులకు మద్దతు కోసం అంకితమైన ప్లేస్‌మెంట్ సెల్`,

        campus: `SRM విశ్వవిద్యాలయ క్యాంపస్‌లో ఉన్నవి:
- స్మార్ట్ టెక్నాలజీతో ఆధునిక తరగతి గదులు
- బాగా సజ్జితమైన ల్యాబొరేటరీలు
- డిజిటల్ వనరులతో సెంట్రల్ లైబ్రరీ
- బాలురు మరియు బాలికల కోసం బహుళ హాస్టళ్లు
- ఫుడ్ కోర్టులు మరియు కేఫేటేరియాలు
- స్విమ్మింగ్ పూల్ సహా క్రీడా సౌకర్యాలు
- వైఫై ఎనేబుల్డ్ క్యాంపస్
- ఆరోగ్య సంరక్షణ కోసం మెడికల్ సెంటర్`,

        hospital: `SRM హాస్పిటల్ ఒక అత్యాధునిక వైద్య సౌకర్యం:
- 24/7 అత్యవసర వైద్య సేవలు
- బయట రోగులు మరియు లోపల రోగుల సంరక్షణ
- అధునాతన డయాగ్నొస్టిక్ సౌకర్యాలు
- వివిధ వైద్య అవసరాల కోసం ప్రత్యేక విభాగాలు
- బాగా అమర్చబడిన ఫార్మసీ
- అంబులెన్స్ సేవలు
- క్రమం తప్పకుండా ఆరోగ్య తనిఖీ శిబిరాలు
- ఆధునిక ఆపరేషన్ థియేటర్లు
- అర్హత కలిగిన వైద్య నిపుణులు మరియు సిబ్బంది`
    },
    ml: {
        admissions: `SRM സർവ്വകലാശാല അഡ്മിഷൻ പ്രക്രിയയിൽ ഉൾപ്പെടുന്നവ:
- SRM വെബ്സൈറ്റ് വഴി ഓൺലൈൻ അപേക്ഷ
- പ്രവേശന പരീക്ഷ (SRMJEEE)
- മെറിറ്റ് അടിസ്ഥാനമാക്കിയുള്ള തിരഞ്ഞെടുപ്പ്
- രേഖകളുടെ പരിശോധന
- പ്രവേശനം സ്ഥിരീകരിക്കാൻ ഫീസ് അടയ്ക്കൽ
- ക്ലാസുകൾ ആരംഭിക്കുന്നതിന് മുമ്പ് ഓറിയന്റേഷൻ പ്രോഗ്രാം`,

        placements: `SRM സർവ്വകലാശാലയ്ക്ക് മികച്ച പ്ലേസ്മെന്റ് റെക്കോർഡ് ഉണ്ട്:
- എല്ലാ പ്രോഗ്രാമുകളിലും 85%+ പ്ലേസ്മെന്റ് നിരക്ക്
- വർഷംതോറും 600+ കമ്പനികൾ ക്യാമ്പസ് സന്ദർശിക്കുന്നു
- ശരാശരി പാക്കേജ് 5-6 LPA
- Microsoft, Amazon, IBM, TCS തുടങ്ങിയവ ടോപ് റിക്രൂട്ടർമാരിൽ ഉൾപ്പെടുന്നു
- പ്രീ-പ്ലേസ്മെന്റ് പരിശീലനം നൽകുന്നു
- വിദ്യാർത്ഥികളുടെ പിന്തുണയ്ക്കായി സമർപ്പിത പ്ലേസ്മെന്റ് സെൽ`,

        campus: `SRM സർവ്വകലാശാല ക്യാമ്പസിൽ ഉള്ളത്:
- സ്മാർട്ട് സാങ്കേതികവിദ്യയുള്ള ആധുനിക ക്ലാസ് മുറികൾ
- നല്ല സജ്ജീകരണങ്ങളുള്ള ലാബുകൾ
- ഡിജിറ്റൽ വിഭവങ്ങളുള്ള സെൻട്രൽ ലൈബ്രറി
- ആൺകുട്ടികൾക്കും പെൺകുട്ടികൾക്കുമായി ഒന്നിലധികം ഹോസ്റ്റലുകൾ
- ഫുഡ് കോർട്ടുകളും കാഫേറ്റീരിയകളും
- സ്വിമ്മിംഗ് പൂൾ ഉൾപ്പെടെയുള്ള കായിക സൗകര്യങ്ങൾ
- വൈഫൈ സജ്ജമാക്കിയ ക്യാമ്പസ്
- ആരോഗ്യ പരിപാലനത്തിനായുള്ള മെഡിക്കൽ സെന്റർ`,

        hospital: `SRM ഹോസ്പിറ്റൽ ഒരു അത്യാധുനിക മെഡിക്കൽ സൗകര്യമാണ്:
- 24/7 അടിയന്തിര മെഡിക്കൽ സേവനങ്ങൾ
- ഔട്ട്പേഷ്യന്റ്, ഇൻപേഷ്യന്റ് പരിചരണം
- വിപുലമായ രോഗനിർണയ സൗകര്യങ്ങൾ
- വിവിധ മെഡിക്കൽ ആവശ്യങ്ങൾക്കായുള്ള സ്പെഷ്യലൈസ്ഡ് ഡിപ്പാർട്ട്മെന്റുകൾ
- നന്നായി സജ്ജീകരിച്ച ഫാർമസി
- ആംബുലൻസ് സേവനങ്ങൾ
- പതിവ് ആരോഗ്യ പരിശോധനാ ക്യാമ്പുകൾ
- ആധുനിക ഓപ്പറേഷൻ തിയേറ്ററുകൾ
- യോഗ്യതയുള്ള മെഡിക്കൽ വിദഗ്ധരും ജീവനക്കാരും`
    } };
    const allSuggestionsTexts = [ /* ... keep your list of suggestion texts ... */ 
        "Admission Process", "Campus Life", "Academic Portal", "Placements",
        "Course Offerings", "Student Life", "Research Programs", "Alumni Network",
        "Academic Calendar", "Library Resources", "Sports Facilities", "Health Services",
        // Add Hindi versions if you want them in autocomplete suggestions shown to user
        "प्रवेश प्रक्रिया", "कैंपस जीवन", "अकादमिक पोर्टल", "प्लेसमेंट",
        "पाठ्यक्रम प्रस्ताव", "छात्र जीवन", "अनुसंधान कार्यक्रम", "पूर्व छात्र नेटवर्क",
        "अकादमिक कैलेंडर", "पुस्तकालय संसाधन", "खेल सुविधाएं", "स्वास्थ्य सेवाएं"
        // ... other relevant terms in all languages ...
    ];
     // Used for autocomplete


    // === Core Functions ===

    // Update UI Language
    function updateUILanguage(lang) {
        currentLanguage = lang;
        if (!translations[lang]) {
            console.error("Language not found in translations:", lang);
            return;
        }
        console.log("Updating UI Language to:", lang); // Log update
        inputElement.placeholder = translations[lang].placeholder;
        // Assuming 'welcome' translation key exists for the disclaimer title
        if (translations[lang].welcome) {
             disclaimerText.textContent = translations[lang].welcome;
        } else {
             console.warn(`Translation key 'welcome' missing for language: ${lang}`);
             // Optional: Fallback text
             disclaimerText.textContent = translations.en.welcome; // Fallback to English
        }


        // Update static suggestions based on matching English text
        document.querySelectorAll('.suggestion').forEach(suggestionElement => {
            const suggestionSpan = suggestionElement.querySelector(".text");
            if (!suggestionSpan) {
                 console.warn("Suggestion element missing '.text' span:", suggestionElement);
                 return; // Skip this suggestion if structure is wrong
            }

            // *** FIX: Get the attribute from the correct element (suggestionElement) ***
            const originalEnglishText = suggestionElement.getAttribute('data-original-text');

            if (!originalEnglishText) {
                // This warning now correctly points to the element that *should* have the attribute
                console.warn("Suggestion element missing 'data-original-text' attribute:", suggestionElement);
                return; // Skip if the original text wasn't stored
            }

            // Find the key matching the stored original English text
            const suggestionKey = Object.keys(translations.en.suggestions).find(
                key => translations.en.suggestions[key] === originalEnglishText
            );

            if (suggestionKey && translations[lang] && translations[lang].suggestions && translations[lang].suggestions[suggestionKey]) {
                // Found key and translation exists for the current language
                suggestionSpan.textContent = translations[lang].suggestions[suggestionKey];
                // console.log(`Translated "${originalEnglishText}" to "${suggestionSpan.textContent}" for lang ${lang}`); // Keep for debugging if needed
            } else {
                // Fallback if no key found or no translation exists for this language
                suggestionSpan.textContent = originalEnglishText; // Revert to original English
                // console.log(`Translation not found for "${originalEnglishText}" (key: ${suggestionKey}) in lang ${lang}. Using English.`); // Keep for debugging
            }
        });
        console.log("UI Language update complete for:", lang);
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
    const createMessageElement = (content, classNames) => {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message"); // e.g., "incoming" or "outgoing"
        if (classNames) {
            // Split the string by spaces and add each class individually
            classNames.split(' ').forEach(cls => {
                if (cls) { // Check for empty strings if there are multiple spaces
                    messageDiv.classList.add(cls.trim());
                }
            });
            // OR using spread syntax if classNames is already an array:
            // messageDiv.classList.add(...classNames);
        }

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
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            if(copyBtn) copyBtn.textContent = "content_copy"; // Check if btn still exists
                        }, 1500);
                    });
               })
               
                
                .catch(err => console.error('Failed to copy text: ', err));
        } else {
            console.error("Could not find text to copy.");
        }
    };
    // Make copyMessage globally accessible for the inline onclick
    window.copyMessage = copyMessage;

    // Process Simple Queries (Greetings, Farewells, Help, specific keywords)
    const processQuery = (query) => {
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
        if (query.toLowerCase().includes('health') || query.toLowerCase().includes('hospital')) {
            return `SRM Hospital is a state-of-the-art medical facility within the university campus that provides:
    - 24/7 emergency medical services
    - Outpatient and inpatient care
    - Advanced diagnostic facilities
    - Specialized departments for various medical needs
    - Well-equipped pharmacy
    - Ambulance services
    - Regular health check-up camps
    - Modern operation theaters
    - Qualified medical professionals and staff
    
    The hospital is equipped to handle both routine medical care and emergencies for students, faculty, and the local community.`;
        }

        return null; // No simple response found
    };
    const formatBotResponse = (response) => {
        // Remove asterisks
        response = response.replace(/ /g, ' ');
        response = response.replace(/[#*]/g, '');
        
        // If response contains bullet points, format them with proper spacing
        if (response.includes('- ')) {
            const lines = response.split('\n');
            const formattedLines = lines.map(line => {
                if (line.trim().startsWith('- ')) {
                    // Add extra indentation and spacing for bullet points
                    return '\n' + line.trim() + '\n';
                }
                return line;
            });
            return formattedLines.join('\n');
        }
        
        return response;
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
    /*const formatBotResponse = (response) => {
        // Basic cleanup: remove extra asterisks, maybe excessive newlines
        response = response.replace(/\*{2,}/g, '*'); // Replace multiple * with single
        response = response.replace(/#/g, '');     // Remove #
        // Convert markdown-like lists to line breaks (simple version)
        response = response.replace(/^\s*[\-\*]\s+/gm, '\n • '); // Basic list conversion
        response = response.replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
        return response.trim();
    };*/

    // Show Typing Effect
    const CONFIG = {
        TYPING_SPEED: 10 // Configurable typing speed
    };
    const showTypingEffect = (text, textElement, messageDiv) => {
        console.log("--- showTypingEffect: STARTED ---");
    
        // 1. --- Safety Check ---
        if (!textElement) {
            console.error("showTypingEffect: Target text element not found. Aborting and resetting state.");
            stopCurrentTypingAndReset(); // Use the reset function on error
            console.log("--- showTypingEffect: FINISHED (Error) ---");
            return;
        }
        console.log("showTypingEffect: textElement found.");
    
        // 2. --- Clear Previous Interval ---
        // Essential to prevent multiple intervals running if messages come fast
        if (currentTypingInterval) {
            console.warn(`showTypingEffect: Clearing PREVIOUS interval ID: ${currentTypingInterval} before starting new one.`);
            clearInterval(currentTypingInterval);
            currentTypingInterval = null; // Nullify immediately
        } else {
            console.log("showTypingEffect: No previous interval found to clear.");
        }
    
        // 3. --- Prepare Text and UI ---
        const formattedText = formatBotResponse(text);
        const words = formattedText.split(/(\s+)/); // Split by space, keeping spaces
        let currentWordIndex = 0;
        textElement.innerHTML = ''; // Clear previous content (like "Bot is thinking...")
        messageDiv.classList.remove("loading"); // Ensure loading class removed visually
        console.log("showTypingEffect: Text prepared, UI cleared.");
    
        // 4. --- Set Button State (to Stop) ---
        // Visually uses 'pause' icon, but functionally means 'stop'
        sendButton.textContent = "pause";
        sendButton.disabled = false; // MUST be enabled so user can click 'stop'
        console.log(`showTypingEffect: Set button text to '${sendButton.textContent}' (stop), disabled = ${sendButton.disabled}`);
    
        // 5. --- Define the Interval Callback ---
        const intervalCallback = () => {
            // Check if interval was stopped externally (e.g., by stopCurrentTypingAndReset)
            // If currentTypingInterval became null, this specific interval instance should stop.
            // Note: This check is a defensive measure; the clearInterval in stopCurrentTypingAndReset
            // is the primary mechanism for stopping.
            if (!currentTypingInterval) {
                 console.log("intervalCallback: Interval seems to have been cleared externally. Stopping callback execution.");
                 // We don't clear again here, just stop executing this instance.
                 return;
            }
    
    
            if (currentWordIndex < words.length) {
                // Append word/space
                textElement.innerHTML += words[currentWordIndex];
                currentWordIndex++;
                // Scroll to bottom
                chatList.scrollTop = chatList.scrollHeight;
            } else {
                // --- Typing Finished Naturally ---
                console.log(`showTypingEffect intervalCallback: Typing finished NATURALLY. Interval ID was: ${currentTypingInterval}`);
                // Use the central reset function for cleanup
                // This will clear the interval, reset flags, and reset the button.
                stopCurrentTypingAndReset();
    
                // Perform actions *specific* to natural completion AFTER resetting state
                const copyButton = messageDiv.querySelector(".copy-button");
                if (copyButton) {
                    copyButton.classList.remove("hide");
                    console.log("showTypingEffect intervalCallback: Copy button shown.");
                }
                // Note: History saving is handled within stopCurrentTypingAndReset
            }
        }; // --- End of intervalCallback definition --- 
        console.trace("Who cleared the interval?");

        currentTypingInterval = setInterval(intervalCallback, 1000 / TYPING_SPEED_FACTOR / 5);
        console.log("Started new typing interval:", currentTypingInterval);
    
        // 6. --- Start the New Interval ---
        const intervalSpeed = 1000 / TYPING_SPEED_FACTOR / 5; // Adjust timing as needed
        currentTypingInterval = setInterval(intervalCallback, intervalSpeed);
        console.log(`showTypingEffect: Started NEW typing interval ID: ${currentTypingInterval} with speed ${intervalSpeed}ms.`);
        console.log("--- showTypingEffect: FINISHED (Setup Complete) ---");
    };

    
    

    
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
    
    // --------------------------------------------------------------------

    // Generate Response (Simple or API)
    const generateAPIResponse = async (incomingMessageDiv) => {
        const textElement = incomingMessageDiv.querySelector(".text");

        // --- DEBUG START ---
        console.log("--- generateAPIResponse: STARTED ---");
        console.log(`generateAPIResponse: User message = "${userMessage}"`);
        console.log(`generateAPIResponse: Current language = "${currentLanguage}"`);
        // --- DEBUG END ---

        if (!userMessage) {
            console.error("generateAPIResponse: userMessage is null or empty!"); // DEBUG
            showTypingEffect("I'm sorry, I couldn't process your message. Please try again.", textElement, incomingMessageDiv);
            stopCurrentTypingAndReset(); // Reset state on error
            return;
        }
        if (!textElement) {
             console.error("generateAPIResponse: textElement not found in incoming message div!"); // DEBUG
             stopCurrentTypingAndReset(); // Reset state on error
             return;
        }


        const simpleResponse = processQuery(userMessage);
        console.log("generateAPIResponse: Simple response check result:", simpleResponse); // DEBUG

        if (simpleResponse) {
            console.log("generateAPIResponse: Using simple response."); // DEBUG
            showTypingEffect(simpleResponse, textElement, incomingMessageDiv);
            // Note: stopCurrentTypingAndReset is called inside showTypingEffect when done/stopped
            return;
        }

        // --- Attempt Knowledge Base (Flask) ---
        let useGemini = false;
        let kbResponseText = null;
        console.log("generateAPIResponse: Attempting Flask KB request..."); // DEBUG
        try {
            const kbFetchStart = Date.now(); // DEBUG Time
            const kbResponse = await fetch(`${FLASK_BASE_URL}/api/query-knowledge-base`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    language: currentLanguage
                })
            });
            const kbFetchEnd = Date.now(); // DEBUG Time
            console.log(`generateAPIResponse: Flask KB response status: ${kbResponse.status} (took ${kbFetchEnd - kbFetchStart}ms)`); // DEBUG

            if (kbResponse.ok) {
                const kbData = await kbResponse.json();
                console.log("generateAPIResponse: Flask KB response data:", kbData); // DEBUG
                if (kbData && kbData.response && typeof kbData.response === 'string' && kbData.response.trim()) {
                    // Clean up potential formatting issues from Python side before showing
                    kbResponseText = kbData.response
                                           .replace(/\\n/g, '\n') // Fix escaped newlines if any
                                           .replace(/[#*]/g, '') // Remove markdown chars
                                           .trim();
                    console.log("generateAPIResponse: Using valid response from Flask KB:", kbResponseText); // DEBUG
                    // Don't set useGemini = false here, let the flow continue
                } else {
                    console.log("generateAPIResponse: Flask KB response OK, but no valid 'response' field found. Will try Gemini."); // DEBUG
                    useGemini = true;
                }
            } else {
                console.error(`generateAPIResponse: Flask KB request failed with status ${kbResponse.status}. Will try Gemini.`); // DEBUG
                useGemini = true; // Try Gemini if Flask fails
            }
        } catch (error) {
            console.error("generateAPIResponse: Error during Flask KB fetch:", error); // DEBUG
            useGemini = true; // Try Gemini if fetch itself fails
        }

        // --- Use Flask KB Response if Available ---
        if (kbResponseText) {
            console.log("generateAPIResponse: Calling showTypingEffect with Flask KB response."); // DEBUG
            showTypingEffect(kbResponseText, textElement, incomingMessageDiv);
            // Note: stopCurrentTypingAndReset is called inside showTypingEffect when done/stopped
            return; // IMPORTANT: Exit here if KB response was used
        }


        // --- Fall back to Gemini API if needed ---
        if (useGemini) {
            console.log("generateAPIResponse: Attempting Gemini API request..."); // DEBUG
            // Add language parameter to the API request (Adjust prompt as needed)
            const apiBody = {
                contents: [{
                    role: "user",
                    parts: [{
                        // Ensure prompt clearly asks for the specific language
                        text: `You are SRM InfoBot. Provide information about the following query regarding SRM University, strictly in the ${translations[currentLanguage]?.welcome ? currentLanguage : 'en'} language: "${userMessage}"`
                    }]
                }],
                // Add safety settings if desired
                // safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ],
                generationConfig: {
                    // Configure temperature, etc. if needed
                    // temperature: 0.7
                }
            };
            console.log("generateAPIResponse: Gemini API request body:", JSON.stringify(apiBody).substring(0, 200) + "..."); // DEBUG log truncated body


            try {
                const geminiFetchStart = Date.now(); // DEBUG Time
                const response = await fetch(API_URL + `?key=${API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(apiBody)
                });
                const geminiFetchEnd = Date.now(); // DEBUG Time
                console.log(`generateAPIResponse: Gemini API response status: ${response.status} (took ${geminiFetchEnd - geminiFetchStart}ms)`); // DEBUG

                if (!response.ok) {
                     // Try to get more error details from Gemini response if possible
                     let errorDetail = `API request failed with status ${response.status}`;
                     try {
                         const errorData = await response.json();
                         console.error("generateAPIResponse: Gemini API error response data:", errorData); // DEBUG
                         errorDetail += `: ${errorData?.error?.message || JSON.stringify(errorData)}`;
                     } catch (parseError) {
                         // Ignore if response body isn't valid JSON
                     }
                     throw new Error(errorDetail);
                 }


                const data = await response.json();
                console.log("generateAPIResponse: Gemini API response data:", data); // DEBUG

                // --- Safely extract text ---
                let apiResponse = null;
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
                    apiResponse = data.candidates[0].content.parts[0].text.trim();
                    console.log("generateAPIResponse: Extracted Gemini text:", apiResponse); // DEBUG
                } else if (data.candidates && data.candidates[0] && data.candidates[0].finishReason) {
                     // Handle cases where generation finished due to safety or other reasons without text
                     apiResponse = `[Response generation stopped by API: ${data.candidates[0].finishReason}]`;
                     console.warn("generateAPIResponse: Gemini generation finished without text. Reason:", data.candidates[0].finishReason); // DEBUG
                 } else {
                     // Handle unexpected response structure
                     console.error("generateAPIResponse: Could not extract text from Gemini response structure.", data); // DEBUG
                     apiResponse = "[Error processing API response]";
                 }

                console.log("generateAPIResponse: Calling showTypingEffect with Gemini response."); // DEBUG
                showTypingEffect(apiResponse, textElement, incomingMessageDiv);
                // Note: stopCurrentTypingAndReset is called inside showTypingEffect when done/stopped
            } catch (error) {
                console.error("generateAPIResponse: Error during Gemini API fetch or processing:", error); // DEBUG
                const errorMessages = { // Provide error messages in different languages
                    en: "I apologize, but I encountered an issue generating a response. Please check the details or try again later.",
                    ta: "மன்னிக்கவும், பதிலளிப்பதில் சிக்கல் ஏற்பட்டது. விவரங்களைச் சரிபார்க்கவும் அல்லது பின்னர் மீண்டும் முயற்சிக்கவும்.",
                    te: "క్షమించండి, ప్రతిస్పందనను రూపొందించడంలో సమస్య ఎదురైంది. దయచేసి వివరాలను తనిఖీ చేయండి లేదా తర్వాత మళ్లీ ప్రయత్నించండి.",
                    ml: "ക്ഷമിക്കണം, ഒരു പ്രതികരണം സൃഷ്ടിക്കുന്നതിൽ ഒരു പ്രശ്നം നേരിട്ടു. ദയവായി വിശദാംശങ്ങൾ പരിശോധിക്കുക അല്ലെങ്കിൽ പിന്നീട് വീണ്ടും ശ്രമിക്കുക.",
                    hi: "क्षमा करें, प्रतिक्रिया उत्पन्न करने में कोई समस्या आई। कृपया विवरण जांचें या बाद में पुनः प्रयास करें।"
                };
                const displayError = `${errorMessages[currentLanguage] || errorMessages.en}\n(Error: ${error.message})`; // Add technical details
                showTypingEffect(displayError, textElement, incomingMessageDiv);
                if (textElement) textElement.classList.add("error"); // Style as error
                 // Note: stopCurrentTypingAndReset is called inside showTypingEffect when done/stopped
                 // We might want to call it explicitly here too if showTypingEffect failed immediately
                 // stopCurrentTypingAndReset(); // Consider if needed
            }
        } else if (!kbResponseText) {
             // This case should ideally not be reached if logic is correct,
             // but acts as a failsafe if neither KB nor Gemini was attempted/successful.
             console.error("generateAPIResponse: Reached end without valid KB response and useGemini is false."); // DEBUG
             const fallbackErrorMsg = "Sorry, I couldn't retrieve information at this time.";
             showTypingEffect(fallbackErrorMsg, textElement, incomingMessageDiv);
             if (textElement) textElement.classList.add("error");
             stopCurrentTypingAndReset(); // Ensure reset
        }
        console.log("--- generateAPIResponse: FINISHED ---"); // DEBUG
    };


    // Handle Outgoing Chat Message
    const handleOutgoingChat = (queryToSend = null) => {
        const messageToSend = queryToSend ? queryToSend.trim() : inputElement.value.trim();
    
        // --- Log state *before* the check ---
        console.log(`handleOutgoingChat called. messageToSend: "${messageToSend}", isResponseGenerating: ${isResponseGenerating}`);
    
        // Guard Clause
        if (!messageToSend || isResponseGenerating) {
            if (!messageToSend) console.log("handleOutgoingChat: Message is empty, returning.");
            // This log is key: Does it trigger when it shouldn't?
            if (isResponseGenerating) console.log("handleOutgoingChat: isResponseGenerating is TRUE, returning.");
            return;
        }
    
        console.log("handleOutgoingChat: Proceeding to send message."); // Should see this if the guard passes
    
        // *** Important: Set the global userMessage to the message we are actually sending ***
        userMessage = messageToSend;
    
        // Set state for sending
        isResponseGenerating = true;
        sendButton.disabled = true; // Disable initially
        sendButton.textContent = 'pause'; // Show pause icon
        console.log("handleOutgoingChat: Set isResponseGenerating=true, button to 'pause', disabled=true");


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
        if (autocompleteList) {
            autocompleteList.innerHTML = ""; // Clear autocomplete
            autocompleteList.style.display = "none";
        } else {
            console.warn("Autocomplete list element not found.");
        }
        //autocompleteList.innerHTML = ""; // Clear autocomplete
        //autocompleteList.style.display = "none";
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
    // Show Bot Loading and Trigger Response Generation
const showBotLoadingAndGenerate = () => {
    const botHtml = `
        <div class="message-content">
            <img src="images/gemini.svg" alt="Bot" class="avatar">
             <div class="loading-indicator"> <!-- Loading bars -->
                <div class="loading-bar"></div>
                <div class="loading-bar"></div>
                <div class="loading-bar"></div>
             </div>
            <p class="text"></p> <!-- *** TARGET FOR TYPING *** -->
        </div>
        <!-- Removed onclick, added a class 'copy-button' for selection -->
        <span class="icon copy-button material-symbols-rounded hide">content_copy</span>
        `;
    const incomingMessageDiv = createMessageElement(botHtml, "incoming loading");
    chatList.appendChild(incomingMessageDiv);
    chatList.scrollTop = chatList.scrollHeight;

    // Add the event listener AFTER appending the element
    const copyBtn = incomingMessageDiv.querySelector(".copy-button");
    if (copyBtn) {
        copyBtn.addEventListener('click', () => copyMessage(copyBtn)); // Pass the button itself
    } else {
        console.warn("Copy button not found in bot message template.");
    }


    // Start generating the actual response
    generateAPIResponse(incomingMessageDiv);
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
    /*const pauseResumeResponse = () => {
        // Add extra guard: only pause/resume if an interval is *actually* running
        if (!isResponseGenerating || !currentTypingInterval) {
            console.warn("pauseResumeResponse called but no active typing interval or not generating.");
            // Optional: Force reset button state if somehow out of sync
            if (!isResponseGenerating) {
                sendButton.textContent = "send";
                sendButton.disabled = false;
            }
            return;
        }
    
        if (isTypingPaused) { // Currently Paused -> Resume
            isTypingPaused = false;
            sendButton.textContent = "pause";
            console.log("Resuming typing. Set button to 'pause'. isTypingPaused=false");
        } else { // Currently Typing -> Pause
            isTypingPaused = true;
            sendButton.textContent = "play_arrow";
            console.log("Pausing typing. Set button to 'play_arrow'. isTypingPaused=true");
        }
    };*/
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

        autocompleteList.style.display = suggestions.length > 0 ? "block" : "none";
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
        e.preventDefault(); 
        const currentButtonState = sendButton.textContent;
        console.log("Send button clicked. Current state:", currentButtonState);
        if (currentButtonState === "pause") { // Functionally means "Stop"
            console.log("Button is 'pause' (stop). Stopping current response...");
            stopCurrentTypingAndReset();
            if (inputElement.value.trim()) {
                console.log("Input has text after stopping. Triggering handleOutgoingChat for new message.");
                // Use a small timeout to ensure state resets fully before starting new send
                setTimeout(() => handleOutgoingChat(), 50);
           } else {
                console.log("Input is empty after stopping. Waiting for user input.");
           }
        } else if (currentButtonState === "send") {
            console.log("Button is 'send'. Handling outgoing chat...");
            handleOutgoingChat(); // Standard send behavior
    
        } else if (currentButtonState === "play_arrow") {
            // This state should no longer exist, but handle defensively
            console.warn("Button clicked in unexpected 'play_arrow' state. Resetting.");
            stopCurrentTypingAndReset(); // Reset if in this invalid state
    
        } else {
            console.warn("Send button clicked with unexpected text:", currentButtonState);
            stopCurrentTypingAndReset(); // Reset if state is unknown
        }
    });
    typingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        console.log("Form submitted (Enter key).");
        // If a response is generating, Enter key should arguably *stop* it first.
        if (isResponseGenerating) {
            console.log("Enter key pressed while generating. Stopping current response.");
            stopCurrentTypingAndReset();
             // Decide if Enter should *also* send the new message immediately after stopping
             // if (inputElement.value.trim()) {
             //    setTimeout(() => handleOutgoingChat(), 50);
             // }
        } else {
            // Only send if not currently generating
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
    document.querySelectorAll('.suggestion').forEach(suggestionElement => {
        const textSpan = suggestionElement.querySelector(".text");
        if (textSpan) {
            // Store the initial English text in a data attribute
            const originalText = textSpan.textContent.trim();
            suggestionElement.setAttribute('data-original-text', originalText);

            // Attach the click listener ONCE during initialization
            suggestionElement.addEventListener('click', () => handleSuggestionClick(suggestionElement));
             console.log(`Added listener for suggestion: "${originalText}"`);
        } else {
            console.warn("Suggestion element found without a '.text' span inside:", suggestionElement);
        }
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
    //updateUILanguage(languageSelect.value || 'en'); // Update based on initial dropdown value
    //showGroup(1);
    //updateButtonVisibility();
    showWelcomeNotification();
});

// Make copyMessage accessible globally
//window.copyMessage = copyMessage;

// Network Event Listeners for debugging
window.addEventListener('offline', () => {
    console.error('Network connection lost. Please check your internet connection.');
});

window.addEventListener('online', () => {
    console.log('Network connection restored.');
});
