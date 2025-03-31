// DOM Element Selections

const FLASK_BASE_URL = 'http://localhost:5000';
let userMessage = null;
let isResponseGenerating = false;
//const API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
/*async function initializeKnowledgeBase() {
    try {
        // Ensure the URL is correct and the server is running
        const response = await fetch(`http://localhost:5000/api/init-knowledge-base`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                // Add CORS headers if needed
                'Access-Control-Allow-Origin': '*'
            }
        });

        if (!response.ok) {
            // More detailed error logging
            const errorText = await response.text();
            console.error(`Knowledge base initialization failed: 
                Status: ${response.status}
                Message: ${errorText}`);
            
            // Retry with exponential backoff
            setTimeout(initializeKnowledgeBase, 2000);
            return;
        }

        const data = await response.json();
        console.log('Knowledge base initialized successfully:', data);
    } catch (error) {
        console.error('Knowledge base connection error:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        console.log('Possible issues:');
        console.log('1. Is the Flask server running?');
        console.log('2. Check server URL: http://localhost:5000');
        console.log('3. Verify CORS configuration');
        console.log('4. Check network connectivity');

        // Retry with exponential backoff
        setTimeout(initializeKnowledgeBase, 5000);
    }
}*/
async function getChatResponse(userMessage) {
    try {
        const response = await fetch(`${FLASK_BASE_URL}/api/query-knowledge-base`, { // Changed endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: userMessage,  // Changed message to query
                language: currentLanguage
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
        }

        const data = await response.json();
        return data.response;

    } catch (error) {
        console.error('Error in getChatResponse:', error);
        return "Sorry, I couldn't get a response. Please try again.";
    }
}
async function displayChatResponse(userMessage) {
    const chatOutput = document.querySelector('.chat-output');
    const botBubble = createChatBubble("Generating response...", false);
    chatOutput.appendChild(botBubble);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    try {
        const response = await getChatResponse(userMessage);
        if (response) {
            botBubble.textContent = response;
        } else {
            botBubble.textContent = "Sorry, I couldn't find relevant information. Please try rephrasing your query.";
        }
    } catch (error) {
        console.error("Error displaying chat response:", error);
        botBubble.textContent = "Failed to generate response.";
    } finally {
        isResponseGenerating = false;
    }
    chatOutput.scrollTop = chatOutput.scrollHeight;
}


let currentLanguage = 'en';


const translations = {
    en: {
        welcome: "Welcome to SRM InfoBot!",
        placeholder: "Ask anything about SRM University...",
        suggestions: {
            admissionProcess: "Admission Process",
            campusLife: "Campus Life",
            academicPortal: "Academic Portal",
            placements: "Placements",
            courseOfferings: "Course Offerings",
            studentLife: "Student Life",
            researchPrograms: "Research Programs",
            alumniNetwork: "Alumni Network",
            academicCalendar: "Academic Calendar",
            libraryResources: "Library Resources",
            sportsFacilities: "Sports Facilities",
            healthServices: "Health Services"
        }
    },
    ta: {
        welcome: "SRM இன்ஃபோபாட்டிற்கு வரவேற்கிறோம்!",
        placeholder: "SRM பல்கலைக்கழகம் பற்றி எதையும் கேளுங்கள்...",
        suggestions: {
            admissionProcess: "சேர்க்கை செயல்முறை",
            campusLife: "வளாக வாழ்க்கை",
            academicPortal: "கல்வி போர்டல்",
            placements: "வேலை வாய்ப்புகள்",
            courseOfferings: "பாடப்பிரிவுகள்",
            studentLife: "மாணவர் வாழ்க்கை",
            researchPrograms: "ஆராய்ச்சி திட்டங்கள்",
            alumniNetwork: "பழைய மாணவர் வலையமைப்பு",
            academicCalendar: "கல்வி காலண்டர்",
            libraryResources: "நூலக வளங்கள்",
            sportsFacilities: "விளையாட்டு வசதிகள்",
            healthServices: "சுகாதார சேவைகள்"
        }
    },
    te: {
        welcome: "SRM ఇన్ఫోబాట్‌కి స్వాగతం!",
        placeholder: "SRM విశ్వవిద్యాలయం గురించి ఏదైనా అడగండి...",
        suggestions: {
            admissionProcess: "ప్రవేశ విధానం",
            campusLife: "క్యాంపస్ జీవితం",
            academicPortal: "విద్యా పోర్టల్",
            placements: "ప్లేస్‌మెంట్స్",
            courseOfferings: "కోర్స్ ఆఫర్లు",
            studentLife: "విద్యార్థి జీవితం",
            researchPrograms: "పరిశోధన కార్యక్రమాలు",
            alumniNetwork: "పూర్వ విద్యార్థుల నెట్‌వర్క్",
            academicCalendar: "విద్యా క్యాలెండర్",
            libraryResources: "లైబ్రరీ వనరులు",
            sportsFacilities: "క్రీడా సౌకర్యాలు",
            healthServices: "ఆరోగ్య సేవలు"
        }
    },
    ml: {
        welcome: "SRM ഇൻഫോബോട്ടിലേക്ക് സ്വാഗതം!",
        placeholder: "SRM സർവകലാശാലയെക്കുറിച്ച് എന്തെങ്കിലും ചോദിക്കൂ...",
        suggestions: {
            admissionProcess: "പ്രവേശന നടപടിക്രമം",
            campusLife: "ക്യാമ്പസ് ജീവിതം",
            academicPortal: "അക്കാദമിക് പോർട്ടൽ",
            placements: "പ്ലേസ്‌മെന്റുകൾ",
            courseOfferings: "കോഴ്‌സ് ഓഫറുകൾ",
            studentLife: "വിദ്യാർത്ഥി ജീവിതം",
            researchPrograms: "ഗവേഷണ പരിപാടികൾ",
            alumniNetwork: "പൂർവ്വ വിദ്യാർത്ഥി ശൃംഖല",
            academicCalendar: "അക്കാദമിക് കലണ്ടർ",
            libraryResources: "ലൈബ്രറി വിഭവങ്ങൾ",
            sportsFacilities: "കായിക സൗകര്യങ്ങൾ",
            healthServices: "ആരോഗ്യ സേവനങ്ങൾ"
        }
    }
};



// API Configuration
//const API_KEY = "AIzaSyBX2WcWwKeTHQvV-_aRYe3IiHYUOdPGD3Y";
//const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;






// Keywords and Patterns
const srmKeywords = [
    // Academic
    'srm', 'university', 'college', 'campus', 'department', 'faculty',
    'course', 'program', 'semester', 'academic', 'study', 'research',
    'lecture', 'class', 'laboratory', 'lab', 'library', 'examination',
    'exam', 'test', 'assignment', 'project', 'grade', 'result',
    'attendance', 'syllabus', 'curriculum', 'timetable', 'schedule',
    
    // Admissions & Fees
    'admission', 'application', 'enrollment', 'registration', 'fee',
    'scholarship', 'financial aid', 'document', 'certificate',
    'eligibility', 'criteria', 'requirement', 'deadline', 'payment',
    
    // Campus Life
    'hostel', 'accommodation', 'dormitory', 'cafeteria', 'canteen',
    'mess', 'food', 'transport', 'bus', 'shuttle', 'parking',
    'security', 'facility', 'amenity', 'infrastructure', 'wifi',
    'internet', 'lab', 'equipment', 'sports', 'gym', 'fitness',
    
    // Student Services
    'student', 'staff', 'faculty', 'teacher', 'professor', 'dean',
    'advisor', 'counselor', 'mentor', 'support', 'help', 'guidance',
    'office', 'department', 'administration', 'management',
    
    // Career & Placement
    'placement', 'career', 'internship', 'job', 'recruitment',
    'company', 'industry', 'corporate', 'salary', 'package',
    'interview', 'training', 'skill', 'development',

    'hospital', 'health', 'medical', 'clinic', 'healthcare', 'emergency',
    'doctor', 'physician', 'ambulance', 'pharmacy', 'medicine', 'treatment',
    'srm hospital', 'medical center', 'health service', 'health care',
    'medical facility', 'emergency care', 'outpatient', 'inpatient'
];

const conversationPatterns = {
    greetings: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
    farewells: ['bye', 'goodbye', 'see you', 'thank you', 'thanks'],
    help: ['help', 'assist', 'support', 'guide', 'what can you do', 'how can you help']
};
const srmPredefinedAnswers = {
    en: {
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
    }
};
function updateUILanguage(lang) {
    currentLanguage = lang;
    document.querySelector('.typing-input').placeholder = translations[lang].placeholder;
    document.querySelector('.disclaimer-text').textContent = translations[lang].welcome;
    const suggestions = document.querySelectorAll('.suggestion .text');
    suggestions.forEach(suggestion => {
        const key = Object.keys(translations.en.suggestions).find(k => translations.en.suggestions[k] === suggestion.getAttribute('data-original-text'));
        if (key) {
            suggestion.textContent = translations[lang].suggestions[key];
        }
    });
}
// Function Declarations
const showWelcomeNotification = () => {
    const notification = document.createElement('div');
    notification.className = 'notification-popup';
    notification.innerHTML = `
        <div class="bot-icon">
            <span class="material-symbols-rounded">smart_toy</span>
        </div>
        <div class="notification-content">
            <div class="notification-title">SRM InfoBot</div>
            <div class="notification-message">👋 Hi! I'm here to help you with any questions about SRM University.</div>
        </div>
        <div class="close-btn">
            <span class="material-symbols-rounded">close</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 1000);

    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    });

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
};
const isSRMKeywordPresent = (message) => {
    const lowerMessage = message.toLowerCase();
    return srmKeywords.some(keyword => lowerMessage.includes(keyword));
};
const checkPredefinedAnswer = (message, lang = 'en') => {
    const lowerMessage = message.toLowerCase();
    for (const key in srmPredefinedAnswers[lang]) {
        if (lowerMessage.includes(key)) {
            return srmPredefinedAnswers[lang][key];
        }
    }
    return null;
};
function createChatBubble(message, isUser) {
    const chatBubble = document.createElement('div');
    chatBubble.classList.add('chat-bubble');
    chatBubble.classList.add(isUser ? 'user-bubble' : 'bot-bubble');
    chatBubble.textContent = message;
    return chatBubble;
}


const createMessageElement = (content, isOutgoing = false) => {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", isOutgoing ? "outgoing" : "incoming");
    messageDiv.innerHTML = content;
    return messageDiv;
};






const isUniversityRelatedQuery = (query) => {
    query = query.toLowerCase();
    return srmKeywords.some(keyword => query.includes(keyword.toLowerCase()));
};








const copyMessage = (copyBtn) => {
    const messageText = copyBtn.parentElement.querySelector(".text").textContent;
    navigator.clipboard.writeText(messageText);
    copyBtn.textContent = "done";
    setTimeout(() => copyBtn.textContent = "content_copy", 1500);
};



// Event Listeners



// Add this to your existing script.js file

// Replace the existing suggestions-related JavaScript with this updated version

document.addEventListener('DOMContentLoaded', () => {
    // Existing DOM Element Selections
    const typingForm = document.querySelector(".typing-form");
    const chatList = document.querySelector(".chat-list");
    const toggleThemeButton = document.querySelector("#toggle-theme-button");
    const deleteChatButton = document.querySelector("#delete-chat-button");
    const languageSelect = document.getElementById('languageSelect');
    const suggestionsGroup1 = document.getElementById('suggestions-group-1');
    const suggestionsGroup2 = document.getElementById('suggestions-group-2');
    const suggestionsGroup3 = document.getElementById('suggestions-group-3');
    const scrollUpButton = document.getElementById('scrollUp');
    const scrollDownButton = document.getElementById('scrollDown');

    // Variables
    let userMessage = null;
    let isResponseGenerating = false;
    let currentGroup = 1;

    // Store original text for language switching
    document.querySelectorAll('.suggestion .text').forEach(suggestion => {
        suggestion.setAttribute('data-original-text', suggestion.textContent);
    });
    
    const processQuery = (query) => {
    
        query = query.toLowerCase().trim();
        if (conversationPatterns.greetings.some(greeting => query.includes(greeting))) {
            const greetings = {
                'en': "Hello! 👋 I'm SRM InfoBot, your university assistant. How can I help you today?",
                'ta': "வணக்கம்! 👋 நான் SRM InfoBot, உங்கள் பல்கலைக்கழக உதவியாளர். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
                'te': "నమస్కారం! 👋 నేను SRM InfoBot, మీ విశ్వవిద్యాలయ సహాయకుడిని. నేను మీకు ఎలా సహాయపడగలను?",
                'ml': "നമസ്കാരം! 👋 ഞാൻ SRM InfoBot, നിങ്ങളുടെ സർവകലാശാല സഹായി. എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാൻ കഴിയും?"
            };
            return greetings[currentLanguage];
        }
        
        if (conversationPatterns.greetings.some(greeting => query.includes(greeting))) {
            return `Hello! 👋 I'm SRM InfoBot, your university assistant. How can I help you today? Feel free to ask about:
    - Admissions and programs
    - Campus facilities
    - Academic information
    - Student services
    - Placements and careers`;
        }
        
        if (conversationPatterns.farewells.some(farewell => query.includes(farewell))) {
            const farewells = {
                'en': "Thank you for chatting with me! If you have more questions, feel free to ask anytime. Have a great day! 😊",
                'ta': "என்னுடன் அரட்டையடித்ததற்கு நன்றி! உங்களுக்கு கூடுதல் கேள்விகள் இருந்தால், எப்போது வேண்டுமானாலும் கேட்கலாம். ஒரு அருமையான நாள் வாழ்த்துக்கள்! 😊",
                'te': "నాతో చాట్ చేసినందుకు ధన్యవాదాలు! మీకు మరిన్ని ప్రశ్నలు ఉంటే, ఎప్పుడైనా అడగడానికి సంకోచించకండి. శుభదినం! 😊",
                'ml': "എന്നോട് സംസാരിച്ചതിന് നന്ദി! നിങ്ങൾക്ക് കൂടുതൽ ചോദ്യങ്ങൾ ഉണ്ടെങ്കിൽ, എപ്പോൾ വേണമെങ്കിലും ചോദിക്കാൻ മടിക്കേണ്ട. നല്ലൊരു ദിവസം ആശംസിക്കുന്നു! 😊"
            };
            return farewells[currentLanguage];
        }
        
        if (conversationPatterns.help.some(helpWord => query.includes(helpWord))) {
            return `I can assist you with various aspects of SRM University:
    1. Academic Information: Courses, programs, departments, faculty
    2. Admission Process: Requirements, applications, documents
    3. Campus Facilities: Hostels, transport, labs, library
    4. Student Services: Support, guidance, mentoring
    5. Career Services: Placements, internships, training
    
    What would you like to know more about?`;
        }
        
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
        
        return null;
    };
    const createMessageElement = (content, isOutgoing = false) => {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", isOutgoing ? "outgoing" : "incoming");
        messageDiv.innerHTML = content;
        return messageDiv;
    };
    const formatBotResponse = (response) => {
        // Remove asterisks
        response = response.replace(/ /g, ' ');
        
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
    const generateAPIResponse = async (incomingMessageDiv) => {
        const textElement = incomingMessageDiv.querySelector(".text");
        
        if (!userMessage) {
            showTypingEffect("I'm sorry, I couldn't process your message. Please try again.", textElement, incomingMessageDiv);
            return;
        }
        const simpleResponse = processQuery(userMessage);
    
        
        if (simpleResponse) {
            showTypingEffect(simpleResponse, textElement, incomingMessageDiv);
            return;
        }
        // Add language parameter to the API request
        const apiBody = {
            contents: [{
                role: "user",
                parts: [{
                    text: `As an SRM University assistant, provide information about: ${userMessage} in ${currentLanguage} language. 
                          Include specific details and keep the response focused on official university information.`
                }]
            }]
        };
    
        try {
            // First try knowledge base
            let useGemini = false;
            try {
                const kbResponse = await fetch(`${FLASK_BASE_URL}/api/query-knowledge-base`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        query: userMessage,
                        language: currentLanguage 
                    })
                });
    
                if (kbResponse.ok) {
                    const kbData = await kbResponse.json();
                    if (kbData.response) {
                        showTypingEffect(kbData.response, textElement, incomingMessageDiv);
                        return;
                    }
                }
                useGemini = true;
            } catch (error) {
                useGemini = true;
            }
    
            // Fall back to Gemini API if needed
            if (useGemini) {
                const response = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(apiBody)
                });
    
                if (!response.ok) throw new Error('API request failed');
                
                const data = await response.json();
                const apiResponse = data.candidates[0].content.parts[0].text.trim();
                showTypingEffect(apiResponse, textElement, incomingMessageDiv);
            }
        } catch (error) {
            const errorMessages = {
                en: "I apologize, but I'm having trouble connecting. Please try again.",
                ta: "மன்னிக்கவும், இணைப்பில் சிக்கல் உள்ளது. மீண்டும் முயற்சிக்கவும்.",
                te: "క్షమించండి, కనెక్ట్ చేయడంలో సమస్య ఉంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
                ml: "ക്ഷമിക്കണം, കണക്റ്റ് ചെയ്യുന്നതിൽ പ്രശ്നമുണ്ട്. വീണ്ടും ശ്രമിക്കുക."
            };
            showTypingEffect(errorMessages[currentLanguage], textElement, incomingMessageDiv);
            textElement.classList.add("error");
        }
    };
    const CONFIG = {
        TYPING_SPEED: 10 // or some other value
      };
    
    const showTypingEffect = (text, element, messageDiv) => {
        const formattedText = formatBotResponse(text);
        const words = formattedText.split(' ');
        let currentIndex = 0;
        element.innerText = '';
        
        const typingInterval = setInterval(() => {
            if (currentIndex < words.length) {
                element.innerText += (currentIndex === 0 ? '' : ' ') + words[currentIndex];
                currentIndex++;
                chatList.scrollTo(0, chatList.scrollHeight);
            } else {
                clearInterval(typingInterval);
                isResponseGenerating = false;
                messageDiv.classList.remove("loading");
                
                if (messageDiv.classList.contains("incoming")) {
                    const copyButton = messageDiv.querySelector(".icon");
                    if (copyButton) copyButton.classList.remove("hide");
                }
                
                localStorage.setItem("savedChats", chatList.innerHTML);
            }
        }, 
        1000 / CONFIG.TYPING_SPEED);
    };
    const handleOutgoingChat = () => {
        const inputElement = typingForm.querySelector(".typing-input");
        userMessage = inputElement.value.trim() || userMessage;
        if (!userMessage || isResponseGenerating) return;

        isResponseGenerating = true;
        
        const html = `
            <div class="message-content">
                <img src="images/user.jpg" alt="User Avatar" class="avatar">
                <p class="text">${userMessage}</p>
            </div>
        `;
        
        
        const outgoingMessageDiv = createMessageElement(html, true);
        chatList.appendChild(outgoingMessageDiv);
        inputElement.value = '';
        
        document.body.classList.add("hide-header");
        chatList.scrollTo(0, chatList.scrollHeight);
        setTimeout(showLoadingAnimation, 500);
    };

    // Event Listeners
    typingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleOutgoingChat();
    });


    const showLoadingAnimation = () => {
        const html = `
            <div class="message-content">
                <img src="images/gemini.svg" alt="Bot Avatar" class="avatar">
                <p class="text"></p>
                <div class="loading-indicator">
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                </div>
            </div>
            <span class="icon material-symbols-rounded hide" onclick="copyMessage(this)">content_copy</span>
        `;
        
        const incomingMessageDiv = createMessageElement(html, false);
        incomingMessageDiv.classList.add("loading");
        chatList.appendChild(incomingMessageDiv);
        chatList.scrollTo(0, chatList.scrollHeight);
        generateAPIResponse(incomingMessageDiv);
    };

    // Suggestion Group Management
    const hideAllGroups = () => {
        [suggestionsGroup1, suggestionsGroup2, suggestionsGroup3].forEach(group => {
            group.style.opacity = '0';
            group.style.visibility = 'hidden';
            group.style.pointerEvents = 'none';
        });
    };

    const showGroup = (groupNumber) => {
        hideAllGroups();
        const group = document.getElementById(`suggestions-group-${groupNumber}`);
        if (group) {
            group.style.opacity = '1';
            group.style.visibility = 'visible';
            group.style.pointerEvents = 'auto';
            group.style.zIndex = '3';
        }
    };

    const updateButtonVisibility = () => {
        scrollUpButton.style.opacity = currentGroup === 1 ? '0.5' : '1';
        scrollUpButton.style.pointerEvents = currentGroup === 1 ? 'none' : 'auto';
        scrollDownButton.style.opacity = currentGroup === 3 ? '0.5' : '1';
        scrollDownButton.style.pointerEvents = currentGroup === 3 ? 'none' : 'auto';
    };

    // Event Listeners for Suggestion Navigation
    scrollUpButton.addEventListener('click', () => {
        if (currentGroup > 1) {
            currentGroup--;
            showGroup(currentGroup);
            updateButtonVisibility();
        }
    });

    scrollDownButton.addEventListener('click', () => {
        if (currentGroup < 3) {
            currentGroup++;
            showGroup(currentGroup);
            updateButtonVisibility();
        }
    });

    // Chat Message Handlers
    

   

    
    // Add click handlers for all suggestions
    document.querySelectorAll('.suggestion').forEach(suggestion => {
        suggestion.addEventListener("click", () => {
            const text = suggestion.querySelector(".text").textContent;
            userMessage = text;
            
            if (text === "Health Services") {
                userMessage = "Tell me about SRM Hospital and its medical services";
            }
            
            handleOutgoingChat();
        });
    });

    // Theme toggle
    toggleThemeButton.addEventListener("click", () => {
        const isLightMode = document.body.classList.toggle("light_mode");
        localStorage.setItem("themeColor", isLightMode ? "light_mode" : "dark_mode");
        toggleThemeButton.innerText = isLightMode ? "dark_mode" : "light_mode";
    });

    

    // Delete chat
    deleteChatButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all messages?")) {
            localStorage.removeItem("savedChats");
            chatList.innerHTML = "";
            document.body.classList.remove("hide-header");
        }
    });

    // Language selection
    languageSelect.addEventListener('change', (e) => {
        updateUILanguage(e.target.value);
    });

    // Initialize
    
    showGroup(1);
    updateButtonVisibility();
    showWelcomeNotification();
    //initializeKnowledgeBase();
});
/*document.addEventListener('DOMContentLoaded', () => {
    const typingInput = document.querySelector('.typing-input');
    const chatOutput = document.querySelector('.chat-output');
    const sendButton = document.querySelector('.send-button');
    const suggestionTexts = document.querySelectorAll('.suggestion .text');
    const languageToggle = document.querySelector('.language-toggle');
    updateUILanguage(currentLanguage);
    showWelcomeNotification();
    const handleSendMessage = () => {
        userMessage = typingInput.value.trim();
        if (userMessage && !isResponseGenerating) {
            isResponseGenerating = true;
            const userBubble = createChatBubble(userMessage, true);
            chatOutput.appendChild(userBubble);
            typingInput.value = '';
            chatOutput.scrollTop = chatOutput.scrollHeight;
            displayChatResponse(userMessage);
        }
    };
    /*sendButton.addEventListener('click', handleSendMessage);
    typingInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleSendMessage();
        }
    });
    suggestionTexts.forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            typingInput.value = suggestion.textContent;
            handleSendMessage();
        });
    });
    languageToggle.addEventListener('click', () => {
        currentLanguage = currentLanguage === 'en' ? 'ta' : 'en';
        updateUILanguage(currentLanguage);
    });
});*/

// Keep existing helper functions
window.copyMessage = copyMessage;
window.addEventListener('offline', () => {
    console.error('Network connection lost. Please check your internet connection.');
});

window.addEventListener('online', () => {
    console.log('Network connection restored. Reinitializing knowledge base...');
    initializeKnowledgeBase();
});