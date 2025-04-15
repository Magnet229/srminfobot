# --- START OF FILE app.py ---

import eel
import sys
import os
from dotenv import load_dotenv
import google.generativeai as genai
from threading import Thread
from flask import Flask, request, jsonify
from flask_cors import CORS
# Remove scraper imports if parsing is done offline - DONE
# from main import SRMScraper # REMOVED
# from scraper_integration import SRMKnowledgeBase, ScraperManager # REMOVED
import logging
import json # Add json import - DONE
# from datetime import datetime # Add datetime import - Not strictly needed by the provided code, but good practice if you use timestamps later. Let's keep it out for now unless explicitly required.
import re   # Add re import - DONE

logging.basicConfig(level=logging.DEBUG)
load_dotenv()

app = Flask(__name__)
CORS(app)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError(
        "No GOOGLE_API_KEY environment variable found.  Please set it in your .env file."
    )
genai.configure(api_key=GOOGLE_API_KEY)

# Gemini model
model = genai.GenerativeModel("gemini-1.5-flash")  # Or 'gemini-pro-vision' if you need image input

# --- Load Structured Data --- # ADDED THIS SECTION
STRUCTURED_DATA_FILE = 'srm_structured_data.json'
srm_data = {}
try:
    with open(STRUCTURED_DATA_FILE, 'r', encoding='utf-8') as f:
        srm_data = json.load(f)
    logging.info(f"Successfully loaded structured data from {STRUCTURED_DATA_FILE}")
    logging.info(f"Data last updated: {srm_data.get('last_updated', 'Unknown')}")
except FileNotFoundError:
    logging.error(f"{STRUCTURED_DATA_FILE} not found. Run the parsing script first.")
    # Optionally exit or continue with limited functionality
except json.JSONDecodeError:
     logging.error(f"Error decoding JSON from {STRUCTURED_DATA_FILE}. File might be corrupt.")
except Exception as e:
     logging.error(f"An error occurred loading {STRUCTURED_DATA_FILE}: {e}")

# --- Predefined Answers & Keywords (Keep these as they handle general topics) ---
srmPredefinedAnswers = {
    'en': {
        'admissions': """SRM University admissions process involves:
- Online application through the SRM website
- Entrance exam (SRMJEEE)
- Merit-based selection
- Document verification
- Fee payment to confirm admission
- Orientation program before classes begin""",
        'placements': """SRM University has an excellent placement record:
- 85%+ placement rate across programs
- 600+ companies visit campus annually
- Average package of 5-6 LPA
- Top recruiters include Microsoft, Amazon, IBM, TCS
- Pre-placement training provided
- Dedicated placement cell for student support""",
        'campus': """SRM University campus features:
- Modern classrooms with smart technology
- Well-equipped laboratories
- Central library with digital resources
- Multiple hostels for boys and girls
- Food courts and cafeterias
- Sports facilities including swimming pool
- Wi-Fi enabled campus
- Medical center for healthcare""",
        'hospital': """SRM Hospital is a state-of-the-art medical facility that provides:
- 24/7 emergency medical services
- Outpatient and inpatient care
- Advanced diagnostic facilities
- Specialized departments for various medical needs
- Well-equipped pharmacy
- Ambulance services
- Regular health check-up camps
- Modern operation theaters
- Qualified medical professionals and staff"""
    },
    'ta': {
        'admissions': """SRM பல்கலைக்கழக சேர்க்கை செயல்முறையில் அடங்கும்:
- SRM இணையதளம் மூலம் ஆன்லைன் விண்ணப்பம்
- நுழைவுத் தேர்வு (SRMJEEE)
- தகுதி அடிப்படையிலான தேர்வு
- ஆவண சரிபார்ப்பு
- சேர்க்கையை உறுதிப்படுத்த கட்டணம் செலுத்துதல்
- வகுப்புகள் தொடங்குவதற்கு முன் அறிமுக நிகழ்ச்சி""",
        'placements': """SRM பல்கலைக்கழகம் சிறந்த வேலைவாய்ப்பு பதிவைக் கொண்டுள்ளது:
- அனைத்து திட்டங்களிலும் 85%+ வேலைவாய்ப்பு விகிதம்
- ஆண்டுதோறும் 600+ நிறுவனங்கள் வளாகத்திற்கு வருகை
- சராசரி பேக்கேஜ் 5-6 LPA
- முன்னணி நிறுவனங்களில் Microsoft, Amazon, IBM, TCS போன்றவை அடங்கும்
- வேலைவாய்ப்புக்கு முந்தைய பயிற்சி வழங்கப்படுகிறது
- மாணவர் ஆதரவுக்கான அர்ப்பணிப்புள்ள வேலைவாய்ப்பு பிரிவு""",
        'campus': """SRM பல்கலைக்கழக வளாகத்தில் உள்ளவை:
- நவீன தொழில்நுட்பத்துடன் கூடிய நவீன வகுப்பறைகள்
- நன்கு வசதிகள் கொண்ட ஆய்வகங்கள்
- டிஜிட்டல் வளங்களுடன் கூடிய மைய நூலகம்
- ஆண், பெண் இருவருக்கும் பல விடுதிகள்
- உணவு அரங்குகள் மற்றும் கஃபேட்டீரியாக்கள்
- நீச்சல் குளம் உட்பட விளையாட்டு வசதிகள்
- வை-ஃபை செயல்படுத்தப்பட்ட வளாகம்
- சுகாதார பராமரிப்புக்கான மருத்துவ மையம்""",
        'hospital': """SRM மருத்துவமனை ஒரு நவீன மருத்துவ வசதியாகும்:
- 24/7 அவசர மருத்துவ சேவைகள்
- வெளிநோயாளி மற்றும் உள்நோயாளி பராமரிப்பு
- மேம்பட்ட நோயறிதல் வசதிகள்
- பல்வேறு மருத்துவ தேவைகளுக்கான சிறப்பு துறைகள்
- நன்கு வசதி கொண்ட மருந்தகம்
- ஆம்புலன்ஸ் சேவைகள்
- வழக்கமான உடல்நல பரிசோதனை முகாம்கள்
- நவீன அறுவை சிகிச்சை அரங்குகள்
- தகுதி வாய்ந்த மருத்துவ நிபுணர்கள் மற்றும் ஊழியர்கள்"""
    },
    'te': {
        'admissions': """SRM విశ్వవిద్యాలయ ప్రవేశ ప్రక్రియలో ఉన్నవి:
- SRM వెబ్‌సైట్ ద్వారా ఆన్‌లైన్ దరఖాస్తు
- ప్రవేశ పరీక్ష (SRMJEEE)
- మెరిట్ ఆధారిత ఎంపిక
- డాక్యుమెంట్ వెరిఫికేషన్
- ప్రవేశాన్ని నిర్ధారించడానికి ఫీజు చెల్లింపు
- తరగతులు ప్రారంభానికి ముందు ఓరియంటేషన్ ప్రోగ్రామ్""",
        'placements': """SRM విశ్వవిద్యాలయానికి ఉత్తమమైన ప్లేస్‌మెంట్ రికార్డు ఉంది:
- అన్ని ప్రోగ్రాముల్లో 85%+ ప్లేస్‌మెంట్ రేటు
- సంవత్సరానికి 600+ కంపెనీలు క్యాంపస్‌కు వస్తాయి
- సగటు ప్యాకేజీ 5-6 LPA
- టాప్ రిక్రూటర్లలో Microsoft, Amazon, IBM, TCS వంటివి ఉన్నాయి
- ప్రీ-ప్లేస్‌మెంట్ ట్రైనింగ్ అందించబడుతుంది
- విద్యార్థులకు మద్దతు కోసం అంకితమైన ప్లేస్‌మెంట్ సెల్""",
        'campus': """SRM విశ్వవిద్యాలయ క్యాంపస్‌లో ఉన్నవి:
- స్మార్ట్ టెక్నాలజీతో ఆధునిక తరగతి గదులు
- బాగా సజ్జితమైన ల్యాబొరేటరీలు
- డిజిటల్ వనరులతో సెంట్రల్ లైబ్రరీ
- బాలురు మరియు బాలికల కోసం బహుళ హాస్టళ్లు
- ఫుడ్ కోర్టులు మరియు కేఫేటేరియాలు
- స్విమ్మింగ్ పూల్ సహా క్రీడా సౌకర్యాలు
- వైఫై ఎనేబుల్డ్ క్యాంపస్
- ఆరోగ్య సంరక్షణ కోసం మెడికల్ సెంటర్""",
        'hospital': """SRM హాస్పిటల్ ఒక అత్యాధునిక వైద్య సౌకర్యం:
- 24/7 అత్యవసర వైద్య సేవలు
- బయట రోగులు మరియు లోపల రోగుల సంరక్షణ
- అధునాతన డయాగ్నొస్టిక్ సౌకర్యాలు
- వివిధ వైద్య అవసరాల కోసం ప్రత్యేక విభాగాలు
- బాగా అమర్చబడిన ఫార్మసీ
- అంబులెన్స్ సేవలు
- క్రమం తప్పకుండా ఆరోగ్య తనిఖీ శిబిరాలు
- ఆధునిక ఆపరేషన్ థియేటర్లు
- అర్హత కలిగిన వైద్య నిపుణులు మరియు సిబ్బంది"""
    },
    'ml': {
        'admissions': """SRM സർവ്വകലാശാല അഡ്മിഷൻ പ്രക്രിയയിൽ ഉൾപ്പെടുന്നവ:
- SRM വെബ്സൈറ്റ് വഴി ഓൺലൈൻ അപേക്ഷ
- പ്രവേശന പരീക്ഷ (SRMJEEE)
- മെറിറ്റ് അടിസ്ഥാനമാക്കിയുള്ള തിരഞ്ഞെടുപ്പ്
- രേഖകളുടെ പരിശോധന
- പ്രവേശനം സ്ഥിരീകരിക്കാൻ ഫീസ് അടയ്ക്കൽ
- ക്ലാസുകൾ ആരംഭിക്കുന്നതിന് മുമ്പ് ഓറിയന്റേഷൻ പ്രോഗ്രാം""",
        'placements': """SRM സർവ്വകലാശാലയ്ക്ക് മികച്ച പ്ലേസ്മെന്റ് റെക്കോർഡ് ഉണ്ട്:
- എല്ലാ പ്രോഗ്രാമുകളിലും 85%+ പ്ലേസ്മെന്റ് നിരക്ക്
- വർഷംതോറും 600+ കമ്പനികൾ ക്യാമ്പസ് സന്ദർശിക്കുന്നു
- ശരാശരി പാക്കേജ് 5-6 LPA
- Microsoft, Amazon, IBM, TCS തുടങ്ങിയവ ടോപ് റിക്രൂട്ടർമാരിൽ ഉൾപ്പെടുന്നു
- പ്രീ-പ്ലേസ്മെന്റ് പരിശീലനം നൽകുന്നു
- വിദ്യാർത്ഥികളുടെ പിന്തുണയ്ക്കായി സമർപ്പിത പ്ലേസ്മെന്റ് സെൽ""",
        'campus': """SRM സർവ്വകലാശാല ക്യാമ്പസിൽ ഉള്ളത്:
- സ്മാർട്ട് സാങ്കേതികവിദ്യയുള്ള ആധുനിക ക്ലാസ് മുറികൾ
- നല്ല സജ്ജീകരണങ്ങളുള്ള ലാബുകൾ
- ഡിജിറ്റൽ വിഭവങ്ങളുള്ള സെൻട്രൽ ലൈബ്രറി
- ആൺകുട്ടികൾക്കും പെൺകുട്ടികൾക്കുമായി ഒന്നിലധികം ഹോസ്റ്റലുകൾ
- ഫുഡ് കോർട്ടുകളും കാഫേറ്റീരിയകളും
- സ്വിമ്മിംഗ് പൂൾ ഉൾപ്പെടെയുള്ള കായിക സൗകര്യങ്ങൾ
- വൈഫൈ സജ്ജമാക്കിയ ക്യാമ്പസ്
- ആരോഗ്യ പരിപാലനത്തിനായുള്ള മെഡിക്കൽ സെന്റർ""",
        'hospital': """SRM ഹോസ്പിറ്റൽ ഒരു അത്യാധുനിക മെഡിക്കൽ സൗകര്യമാണ്:
- 24/7 അടിയന്തിര മെഡിക്കൽ സേവനങ്ങൾ
- ഔട്ട്പേഷ്യന്റ്, ഇൻപേഷ്യന്റ് പരിചരണം
- വിപുലമായ രോഗനിർണയ സൗകര്യങ്ങൾ
- വിവിധ മെഡിക്കൽ ആവശ്യങ്ങൾക്കായുള്ള സ്പെഷ്യലൈസ്ഡ് ഡിപ്പാർട്ട്മെന്റുകൾ
- നന്നായി സജ്ജീകരിച്ച ഫാർമസി
- ആംബുലൻസ് സേവനങ്ങൾ
- പതിവ് ആരോഗ്യ പരിശോധനാ ക്യാമ്പുകൾ
- ആധുനിക ഓപ്പറേഷൻ തിയേറ്ററുകൾ
- യോഗ്യതയുള്ള മെഡിക്കൽ വിദഗ്ധരും ജീവനക്കാരും"""
    },
    'hi': {
        'admissions': """SRM विश्वविद्यालय प्रवेश प्रक्रिया में शामिल हैं:
- SRM वेबसाइट के माध्यम से ऑनलाइन आवेदन
- प्रवेश परीक्षा (SRMJEEE)
- योग्यता-आधारित चयन
- दस्तावेज़ सत्यापन
- प्रवेश की पुष्टि के लिए शुल्क भुगतान
- कक्षाएं शुरू होने से पहले ओरिएंटेशन कार्यक्रम""",
        'placements': """SRM विश्वविद्यालय का प्लेसमेंट रिकॉर्ड उत्कृष्ट है:
- सभी प्रोग्रामों में 85%+ प्लेसमेंट दर
- सालाना 600+ कंपनियां कैंपस आती हैं
- औसत पैकेज 5-6 LPA
- शीर्ष नियोक्ताओं में Microsoft, Amazon, IBM, TCS शामिल हैं
- प्री-प्लेसमेंट प्रशिक्षण प्रदान किया जाता है
- छात्र सहायता के लिए समर्पित प्लेसमेंट सेल""",
        'campus': """SRM विश्वविद्यालय परिसर की विशेषताएं:
- स्मार्ट तकनीक वाले आधुनिक कक्षाएँ
- अच्छी तरह से सुसज्जित प्रयोगशालाएँ
- डिजिटल संसाधनों वाला केंद्रीय पुस्तकालय
- लड़कों और लड़कियों के लिए कई छात्रावास
- फूड कोर्ट और कैफेटेरिया
- स्विमिंग पूल सहित खेल सुविधाएं
- वाई-फाई सक्षम परिसर
- स्वास्थ्य देखभाल के लिए चिकित्सा केंद्र""",
        'hospital': """SRM अस्पताल एक अत्याधुनिक चिकित्सा सुविधा है जो प्रदान करता है:
- 24/7 आपातकालीन चिकित्सा सेवाएं
- बाह्य रोगी (OPD) और आंतरिक रोगी (IPD) देखभाल
- उन्नत नैदानिक सुविधाएं
- विभिन्न चिकित्सा आवश्यकताओं के लिए विशेष विभाग
- अच्छी तरह से सुसज्जित फार्मेसी
- एम्बुलेंस सेवाएं
- नियमित स्वास्थ्य जांच शिविर
- आधुनिक ऑपरेशन थिएटर
- योग्य चिकित्सा पेशेवर और कर्मचारी"""
    }
    # --- END HINDI --- # KEPT
}


# Keywords to identify predefined topics (add more as needed)
PREDEFINED_TOPIC_KEYWORDS = {
    # These handle general topics, FEES/SCHOLARSHIP/PROGRAMS handled separately below
    'hospital': [
        'hospital', 'health', 'medical', 'clinic', 'doctor', 'emergency', 'pharmacy',  # English
        'மருத்துவமனை', 'சுகாதாரம்', 'மருத்துவம்', 'மருந்தகம்', 'மருத்துவர்', 'அவசரம்',  # Tamil
        'హాస్పిటల్', 'ఆసుపత్రి', 'ఆరోగ్యం', 'వైద్య', 'క్లినిక్', 'డాక్టర్', 'ఫార్మసీ', 'అత్యవసరం', 'ఆరోగ్య సేవలు', # Telugu (added ఆరోగ్య సేవలు)
        'ആശുപത്രി', 'ആരോഗ്യം', 'മെഡിക്കൽ', 'ക്ലിനിക്ക്', 'ഡോക്ടർ', 'ഫാർമസി', 'അടിയന്തരാവസ്ഥ', # Malayalam
         'अस्पताल', 'स्वास्थ्य', 'चिकित्सा', 'क्लिनिक', 'डॉक्टर', 'आपातकाल', 'फार्मेसी', 'सेवाएं', # Hindi - ADDED
    ],
    'admissions': [
        'admission', 'admissions', 'apply', 'enroll', 'register', 'application', 'srmjeee', # English
        'சேர்க்கை', 'விண்ணப்பிக்க', 'பதிவு', # Tamil
        'ప్రవేశం', 'నమోదు', 'దరఖాస్తు', # Telugu
        'അഡ്മിഷൻ', 'രജിസ്റ്റർ', 'അപേക്ഷിക്കുക', # Malayalam
         'प्रवेश', 'आवेदन', 'दाखिला', 'पंजीकरण', 'अप्लाई', # Hindi - ADDED
    ],
    'placements': [
        'placement', 'placements', 'job', 'jobs', 'career', 'recruit', 'company', 'salary', # English
        'வேலைவாய்ப்பு', 'வேலை', 'நிறுவனம்', 'சம்பளம்', # Tamil
        'ప్లేస్‌మెంట్', 'ఉద్యోగం', 'కంపెనీ', 'జీతం', # Telugu
        'പ്ലേസ്മെന്റ്', 'തൊഴിൽ', 'കമ്പനി', 'ശമ്പളം', # Malayalam
        'प्लेसमेंट', 'नौकरी', 'कंपनी', 'वेतन', 'भर्ती', 'करियर', # Hindi - ADDED
    ],
    'campus': [
        'campus', 'life', 'facilities', 'hostel', 'library', 'sports', 'wifi', # English
        'வளாகம்', 'வாழ்க்கை', 'வசதிகள்', 'விடுதி', 'நூலகம்', 'விளையாட்டு', # Tamil
        'క్యాంపస్', 'జీవితం', 'సౌకర్యాలు', 'హాస్టల్', 'లైబ్రరీ', 'క్రీడలు', # Telugu
        'ക്യാമ്പസ്', 'ജീവിതം', 'സൗകര്യങ്ങൾ', 'ഹോസ്റ്റൽ', 'ലൈബ്രറി', 'സ്പോർട്സ്', # Malayalam
        'कैंपस', 'जीवन', 'सुविधाएं', 'छात्रावास', 'पुस्तकालय', 'खेल', 'वाईफ़ाई', 'इंफ्रास्ट्रक्चर', # Hindi - ADDED
    ]
    # NOTE: Removed specific fee/scholarship/program keywords from *this* dict
    # as they are handled by specific checks later.
} # KEPT

# --- New Search Functions for Structured Data --- # ADDED THESE FUNCTIONS
def normalize_query_program(query):
    """Extracts potential program names and normalizes them."""
    # Basic: look for patterns like "b.tech cse", "mtech vlsi", etc.
    # Convert to lowercase for matching keys in srm_data
    query = query.lower()
    # Remove fee/admission related words to isolate program name
    query = re.sub(r'\b(fee|fees|cost|admission|application|process)\b', '', query, flags=re.IGNORECASE)
    # Attempt to clean - this is basic, might need refinement
    query = query.replace('b.tech.', 'b.tech').replace('m.tech.', 'm.tech')
    query = re.sub(r'[^\w\s.-]', '', query) # Remove punctuation except dots/hyphens
    query = re.sub(r'\s+', ' ', query).strip()
    # Very simple: assume the remaining part is the program name - needs improvement
    # Maybe look for keywords like 'engineering', 'biotechnology' etc.
    return query # Return the cleaned query, potentially the program name

def search_fees(program_query):
    """Searches the structured data for fee information."""
    if not srm_data or ('fees_ug' not in srm_data and 'fees_pg' not in srm_data):
        return None

    normalized_query = normalize_query_program(program_query)
    logging.debug(f"Searching fees for normalized query: '{normalized_query}'")

    # Check both UG and PG fees
    fee_data = srm_data.get('fees_ug', {}).get(normalized_query) or \
               srm_data.get('fees_pg', {}).get(normalized_query)

    if fee_data:
        logging.info(f"Found fee data for '{normalized_query}'")
        # Format the response
        return f"Fee structure for {normalized_query.title()}:\n• Duration: {fee_data.get('duration', 'N/A')}\n• Annual Fees: ₹{fee_data.get('annual_fees', 'N/A')}\n• Intake: {fee_data.get('intake', 'N/A')}"
    else:
         # Basic substring search as fallback (less accurate)
         logging.debug(f"Exact match failed for '{normalized_query}'. Trying substring search.")
         all_fees = {**srm_data.get('fees_ug', {}), **srm_data.get('fees_pg', {})}
         possible_matches = []
         for prog_key, fee_details in all_fees.items():
              # Use lowercase for comparison robustness
              if normalized_query in prog_key.lower():
                   possible_matches.append(
                        f"{prog_key.title()}:\n  • Duration: {fee_details.get('duration', 'N/A')}\n  • Annual Fees: ₹{fee_details.get('annual_fees', 'N/A')}\n  • Intake: {fee_details.get('intake', 'N/A')}"
                   )
         if possible_matches:
              logging.info(f"Found possible fee matches for '{normalized_query}' via substring.")
              response = "Found possible matches for your query:\n" + "\n\n".join(possible_matches[:3]) # Limit results
              return response

    logging.warning(f"Could not find fee data for query: '{program_query}' (normalized: '{normalized_query}')")
    return None


def search_scholarships(query):
    """Searches the structured scholarship data."""
    if not srm_data or 'scholarships' not in srm_data:
        return None

    query_lower = query.lower()
    # Keywords for general scholarship info
    general_keywords = ['scholarship', 'scholarships', 'financial aid', 'concession', 'ews', 'founder', 'merit'] # Added keywords
    is_general_query = any(kw in query_lower for kw in general_keywords)

    found_scholarships = []

    # Search based on keywords in the raw data of each scholarship entry
    # Assumes structure from a parser like: [{'Category': 'Founder\'s', 'raw_data': ['100% tuition...', ...]}, ...]
    for scholarship in srm_data.get('scholarships', []): # Use .get for safety
        if not isinstance(scholarship, dict): # Basic type check
            logging.warning(f"Skipping non-dict item in scholarships list: {scholarship}")
            continue

        category = scholarship.get('Category', '').lower()
        # Ensure raw_data is a list of strings before joining
        raw_data_list = scholarship.get('raw_data', [])
        if not isinstance(raw_data_list, list):
            raw_data_list = [str(raw_data_list)] # Attempt to convert if not a list

        raw_data_str = ' '.join(map(str, raw_data_list)).lower() # Convert items to string before joining

        # Improved matching logic
        match_reason = None
        if category and category in query_lower: # Match specific category name
            match_reason = f"Category match ('{category}')"
        elif any(kw in query_lower for kw in general_keywords): # Match general scholarship keywords
             match_reason = f"General keyword match"
        elif any(term in raw_data_str for term in query_lower.split() if len(term) > 3): # Match specific terms from query in details
             match_reason = f"Term match in details"

        if match_reason:
            logging.debug(f"Scholarship matched: {scholarship.get('Category', 'Unknown')} due to {match_reason}")
            found_scholarships.append(scholarship)


    if found_scholarships:
        response_parts = ["Here is information on scholarships based on your query:"]
        # Use a set to avoid duplicate entries if matched multiple ways
        unique_categories_shown = set()
        added_count = 0
        for schol in found_scholarships:
            category = schol.get('Category', 'Details')
            if category not in unique_categories_shown and added_count < 5: # Limit results & prevent duplicates
                details_list = schol.get('raw_data', ['No details available.'])
                # Format details as bullet points
                formatted_details = "\n  • ".join(filter(None, map(str.strip, details_list))) # Ensure items are strings and remove empty ones
                if formatted_details:
                    response_parts.append(f"\n--- {category.title()} ---\n  • {formatted_details}")
                else:
                    response_parts.append(f"\n--- {category.title()} ---\n  No specific details available.")
                unique_categories_shown.add(category)
                added_count += 1
        return "\n".join(response_parts)

    elif is_general_query:
         # Provide a more informative general response if no specific match
         return "SRM offers various scholarships, including Founder's Scholarship, Merit Scholarship, Socio-Economic Scholarships, Differently-Abled Scholarships, and SRM Arts and Culture Scholarships. Could you specify which one you're interested in, or would you like general criteria?"

    return None

def search_programs(query):
    """Lists programs, optionally filtered by department or keywords."""
    if not srm_data or ('programs_ug' not in srm_data and 'programs_pg' not in srm_data):
        return None

    query_lower = query.lower()
    response_parts = []
    found = False

    # Combine UG and PG for searching, ensuring values are lists
    all_programs_by_dept = {
        **srm_data.get('programs_ug', {}),
        **srm_data.get('programs_pg', {})
    }

    # Normalize department keys for matching
    dept_map = {dept.lower(): dept for dept in all_programs_by_dept.keys()}

    # Check if query matches a department name (case-insensitive)
    matched_dept_key = None
    # Prioritize longer matches first if query contains multiple potential dept names
    sorted_dept_keys = sorted(dept_map.keys(), key=len, reverse=True)
    for dept_key_lower in sorted_dept_keys:
        if dept_key_lower in query_lower:
            matched_dept_key = dept_key_lower
            break

    if matched_dept_key:
        original_dept_name = dept_map[matched_dept_key]
        response_parts.append(f"Programs offered by the Department of {original_dept_name}:")

        # Safely get programs using the original department name
        ug_progs = srm_data.get('programs_ug', {}).get(original_dept_name, [])
        pg_progs = srm_data.get('programs_pg', {}).get(original_dept_name, [])

        # Ensure they are lists before iterating
        if isinstance(ug_progs, list) and ug_progs:
             response_parts.append("\nUndergraduate:")
             for prog in ug_progs: response_parts.append(f" • {prog.title()}")
             found = True
        if isinstance(pg_progs, list) and pg_progs:
             response_parts.append("\nPostgraduate:")
             for prog in pg_progs: response_parts.append(f" • {prog.title()}")
             found = True

        if not found:
             response_parts.append("No specific programs listed for this department in the available data.")
             found = True # Still count as found to prevent keyword search

    # Only do keyword search if no department was matched
    if not found:
        # General search for program keywords across all departments
        # Exclude common words and department names already checked
        exclude_words = ['list', 'programs', 'courses', 'department', 'details', 'about'] + list(dept_map.keys())
        keywords = [term for term in query_lower.split() if len(term) > 2 and term not in exclude_words]

        if keywords:
             logging.debug(f"Searching programs with keywords: {keywords}")
             response_parts.append("Found programs matching your query:")
             count = 0
             matched_progs = set() # Avoid duplicates

             for dept, programs in all_programs_by_dept.items():
                  if isinstance(programs, list): # Ensure it's a list
                      for prog in programs:
                           prog_lower = prog.lower() # Search case-insensitively
                           if any(kw in prog_lower for kw in keywords):
                                prog_info = f" • {prog.title()} (Dept: {dept})"
                                if prog_info not in matched_progs:
                                    response_parts.append(prog_info)
                                    matched_progs.add(prog_info)
                                    found = True
                                    count += 1
                                    if count >= 15: break # Limit results slightly more
                  if count >= 15: break

             if not found:
                 # Adjust message if keywords were present but no match
                 response_parts = [f"Couldn't find programs specifically matching '{' '.join(keywords)}'. You can ask about specific departments."]
                 found = True # Set found to true to prevent falling through to Gemini unnecessarily

    return "\n".join(response_parts) if found else None

# Initialize components - REMOVED
# knowledge_base = SRMKnowledgeBase() # REMOVED
# scraper = SRMScraper() # REMOVED
# scraper_manager = ScraperManager(scraper, knowledge_base) # REMOVED

# Check and initialize the knowledge base if the data file is empty or does not exist - REMOVED
# if not os.path.exists(knowledge_base.data_file) or os.path.getsize(knowledge_base.data_file) == 0: # REMOVED
#     logging.info("Initializing knowledge base with default data") # REMOVED
#     try: # REMOVED
#         scraper_manager.check_and_update() # REMOVED
#     except Exception as e: # REMOVED
#         logging.error(f"Error during initial scraping: {e}") # REMOVED

# Function to query the knowledge base - REWRITTEN
@app.route("/api/query-knowledge-base", methods=["POST"])
def query_knowledge_base():
    query = None # Initialize query to None
    language_code = 'en' # Initialize language_code
    try:
        data = request.json
        query = data.get("query")
        language_code = data.get("language", "en")  # Get language code, default to 'en'

        # --- DETAILED LOGGING: Request Received ---
        logging.debug(f"--- Request Received ---")
        logging.debug(f"Raw Query: '{query}'")
        logging.debug(f"Language Code: '{language_code}'")
        # --- End Logging ---

        if not query:
            logging.warning("Query endpoint called without a query.")
            return jsonify({"error": "No query provided"}), 400

        query_lower = query.lower() # Convert query to lowercase once
        logging.debug(f"Lowercase Query: '{query_lower}'")

        response = None # Variable to hold the final response

        # --- ORDER OF CHECKS ---

        # 1. General Predefined Answers (Hospital, Campus Life Overview, etc.)
        #    Uses PREDEFINED_TOPIC_KEYWORDS which *excludes* fees/scholarships/programs
        logging.debug("--- Checking General Predefined Answers ---")
        matched_topic_key = None
        for topic_key, keywords in PREDEFINED_TOPIC_KEYWORDS.items():
            logging.debug(f"Checking topic: '{topic_key}'")
            keyword_found = False
            for keyword in keywords:
                # Basic check: keyword exists in the query
                if keyword in query_lower:
                    # Optional: Add more sophisticated matching here if needed (e.g., word boundaries)
                    logging.debug(f"  MATCH FOUND! Keyword '{keyword}' in query '{query_lower}' for general topic '{topic_key}'")
                    matched_topic_key = topic_key
                    keyword_found = True
                    break # Stop checking keywords for this topic
            if keyword_found:
                logging.debug(f"General Topic '{matched_topic_key}' identified.")
                break # Stop checking other topics

        if matched_topic_key:
            logging.debug(f"Attempting to retrieve general predefined answer for topic '{matched_topic_key}', language '{language_code}'")
            if language_code in srmPredefinedAnswers and matched_topic_key in srmPredefinedAnswers[language_code]:
                predefined_response = srmPredefinedAnswers[language_code][matched_topic_key]
                logging.info(f"SUCCESS: Found general predefined answer for '{matched_topic_key}' in '{language_code}'.")

                # Apply simple formatting
                formatted_predefined_response = ""
                lines = predefined_response.strip().split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('- '):
                         formatted_predefined_response += f"• {line[2:].strip()}\n" # Use bullet symbol
                    elif line:
                         formatted_predefined_response += f"{line}\n"
                response = formatted_predefined_response.strip()

            else:
                logging.warning(f"General predefined topic '{matched_topic_key}' matched, but NO ANSWER found for language '{language_code}'. Proceeding...")
        else:
            logging.debug("No general predefined topic matched the query.")


        # 2. Specific Structured Data Search (Fees, Scholarships, Programs)
        #    Only run these checks if a general predefined answer wasn't found.
        if response is None:
            fee_keywords = ['fee', 'fees', 'cost', 'tuition', 'price', 'structure', 'payment', 'amount', 'rupees', '₹']
            scholarship_keywords = ['scholarship', 'scholarships', 'financial aid', 'concession', 'ews', 'founder', 'merit', 'grant', 'waiver']
            program_keywords = ['program', 'programs', 'course', 'courses', 'department', 'departments', 'major', 'specialization', 'b.tech', 'm.tech', 'degree', 'branch', 'discipline'] # Added more variations

            logging.debug("--- Checking Specific Structured Data ---")

            # Check for Fees
            if any(kw in query_lower for kw in fee_keywords):
                logging.debug("Query contains fee keywords. Checking structured data for Fees...")
                response = search_fees(query) # Pass original query for better context in normalization
                if response:
                    logging.info("Found fee information in structured data.")
                else:
                    logging.info("Fee keywords present, but no specific fee data found in structured data.")

            # Check for Scholarships (if fees didn't match)
            if response is None and any(kw in query_lower for kw in scholarship_keywords):
                 logging.debug("Query contains scholarship keywords. Checking structured data for Scholarships...")
                 response = search_scholarships(query)
                 if response:
                     logging.info("Found scholarship information in structured data.")
                 else:
                    logging.info("Scholarship keywords present, but no specific scholarship data found in structured data.")

            # Check for Programs (if fees/scholarships didn't match)
            if response is None and any(kw in query_lower for kw in program_keywords):
                logging.debug("Query contains program/department keywords. Checking structured data for Programs...")
                response = search_programs(query)
                if response:
                    logging.info("Found program/department information in structured data.")
                else:
                    logging.info("Program/department keywords present, but no specific program data found in structured data.")


        # 3. Fallback to Gemini API (If still no response after all checks)
        if response is None:
            logging.info(f"No specific answer found in predefined or structured data. Querying Gemini in language '{language_code}'...")

            try:
                language_map = {
                    'en': 'English', 'ta': 'Tamil', 'te': 'Telugu', 'ml': 'Malayalam', 'hi': 'Hindi' # Added Hindi
                }
                language_name = language_map.get(language_code, 'English') # Default to English if code unknown

                strict_prompt = f"""
                You are SRM InfoBot, a helpful assistant for SRM University (India).
                The user's query is: "{query}"

                **VERY IMPORTANT INSTRUCTION:** Your response MUST be **ONLY** in the **{language_name}** language (language code: {language_code}).
                **DO NOT** use English or any other language unless the requested language is English.
                **DO NOT** include explanations like "Unfortunately, I don't have..." or "I couldn't find information...".
                **DO NOT** apologize for missing information.

                1. Prioritize information specifically about **SRM University**.
                2. If you have specific, factual information about SRM University relevant to the query "{query}", provide it concisely in **{language_name}**.
                3. If you DO NOT have specific SRM information for the query "{query}", provide a *general* answer about the topic (like campus life, admissions, course types, etc.) based on typical university information in India, but ensure the answer is still **strictly and ONLY in {language_name}**. Avoid making up SRM-specific details.

                Generate ONLY the answer text in **{language_name}**. No preambles, no apologies, no language explanations. Format the response clearly, using bullet points (like • point) where appropriate for lists.
                """

                logging.debug(f"Sending prompt to Gemini (Lang: {language_name}):\n{strict_prompt[:500]}...") # Log beginning of prompt
                gemini_response = model.generate_content(strict_prompt)

                # Extract text (handle different response structures)
                response_text = None
                try:
                    if hasattr(gemini_response, 'text') and gemini_response.text:
                         response_text = gemini_response.text
                    elif hasattr(gemini_response, 'parts') and gemini_response.parts:
                         # Handle potential multi-part responses
                         response_text = "".join(part.text for part in gemini_response.parts if hasattr(part, 'text'))
                    elif hasattr(gemini_response, 'candidates') and gemini_response.candidates:
                         # Access content safely, checking existence of attributes
                         candidate = gemini_response.candidates[0]
                         if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts') and candidate.content.parts:
                              response_text = "".join(part.text for part in candidate.content.parts if hasattr(part, 'text'))

                except Exception as extract_err:
                     logging.error(f"Error extracting text from Gemini response: {extract_err}")
                     response_text = None # Ensure it's None if extraction fails

                if response_text:
                    response = response_text.strip()
                    # Apply simple formatting consistency
                    formatted_gemini_response = ""
                    lines = response.strip().split('\n')
                    for line in lines:
                        line = line.strip()
                        # Handle common list markers
                        if line.startswith(('* ', '- ', '• ')):
                            formatted_gemini_response += f"• {line[2:].strip()}\n"
                        elif line:
                            formatted_gemini_response += f"{line}\n"
                    response = formatted_gemini_response.strip()
                    logging.info(f"Received and formatted Gemini response for '{query}' in {language_code}.")
                else:
                    # Handle cases where Gemini genuinely might not have an answer or response is blocked
                    error_messages_gemini = {
                        'en': "I couldn't generate a specific answer for that query right now.",
                        'ta': "மன்னிக்கவும், அந்த வினவலுக்கு என்னால் தற்போது ஒரு குறிப்பிட்ட பதிலை உருவாக்க முடியவில்லை.",
                        'te': "క్షమించండి, ప్రస్తుతానికి ఆ ప్రశ్నకు నేను నిర్దిష్ట సమాధానాన్ని రూపొందించలేకపోయాను.",
                        'ml': "ക്ഷമിക്കണം, ആ ചോദ്യത്തിന് ഇപ്പോൾ ഒരു പ്രത്യേക ഉത്തരം നൽകാൻ എനിക്ക് കഴിഞ്ഞില്ല.",
                        'hi': "क्षमा करें, मैं इस समय उस प्रश्न के लिए विशिष्ट उत्तर उत्पन्न नहीं कर सका।" # Added Hindi
                    }
                    response = error_messages_gemini.get(language_code, error_messages_gemini['en'])
                    logging.warning(f"Gemini did not return usable text content for query '{query}'. Using default message.")

            except Exception as e:
                logging.error(f"Gemini API Error while processing query '{query}': {e}", exc_info=True)
                error_messages_api = {
                    'en': "Sorry, an internal error occurred while trying to get an answer.",
                    'ta': "மன்னிக்கவும், பதிலைப் பெற முயற்சிக்கும்போது ஒரு உள் பிழை ஏற்பட்டது.",
                    'te': "క్షమించండి, సమాధానం పొందడానికి ప్రయత్నిస్తున్నప్పుడు అంతర్గత లోపం సంభవించింది.",
                    'ml': "ക്ഷമിക്കണം, ഉത്തരം ലഭിക്കാൻ ശ്രമിക്കുമ്പോൾ ഒരു ആന്തരിക പിശക് സംഭവിച്ചു.",
                    'hi': "क्षमा करें, उत्तर प्राप्त करने का प्रयास करते समय एक आंतरिक त्रुटि हुई।" # Added Hindi
                }
                response = error_messages_api.get(language_code, error_messages_api['en'])

        # --- Final Response ---
        if response is None: # Ultimate fallback (should rarely happen now)
            logging.warning("All methods (predefined, structured, Gemini) failed to generate a response.")
            fallback_msgs = {
                 'en': "Sorry, I couldn't find specific information for your query at this time.",
                 'ta': "மன்னிக்கவும், உங்கள் வினவலுக்கான குறிப்பிட்ட தகவலை இந்த நேரத்தில் என்னால் கண்டுபிடிக்க முடியவில்லை.",
                 'te': "క్షమించండి, మీ ప్రశ్నకు సంబంధించిన నిర్దిష్ట సమాచారాన్ని నేను ఈ సమయంలో కనుగొనలేకపోయాను.",
                 'ml': "ക്ഷമിക്കണം, നിങ്ങളുടെ ചോദ്യത്തിനുള്ള പ്രത്യേക വിവരങ്ങൾ കണ്ടെത്താൻ എനിക്കിപ്പോൾ കഴിഞ്ഞില്ല.",
                 'hi': "क्षमा करें, मुझे इस समय आपके प्रश्न के लिए विशिष्ट जानकारी नहीं मिल सकी।" # Added Hindi
            }
            response = fallback_msgs.get(language_code, fallback_msgs['en'])

        # --- DETAILED LOGGING: Sending Response ---
        logging.debug(f"--- Sending Response ---")
        logging.debug(f"Final Response (Lang: {language_code}):\n{response[:300]}...") # Log start of response
        logging.debug(f"--- END Request ---")
        # --- End Logging ---

        return jsonify({"status": "success", "response": response})

    except Exception as e:
        # --- LOGGING: Unexpected Error ---
        logging.exception(f"Unexpected error in query_knowledge_base for query='{query or 'No query provided'}' language='{language_code}'")
        # Ensure response structure is consistent even on error
        error_messages_server = {
            'en': "Sorry, a server error occurred.",
            'ta': "மன்னிக்கவும், சர்வர் பிழை ஏற்பட்டது.",
            'te': "క్షమించండి, సర్వర్ లోపం సంభవించింది.",
            'ml': "ക്ഷമിക്കണം, ഒരു സെർവർ പിശക് സംഭവിച്ചു.",
            'hi': "क्षमा करें, एक सर्वर त्रुटि हुई।" # Added Hindi
         }
        server_error_response = error_messages_server.get(language_code, error_messages_server['en'])
        # --- DETAILED LOGGING: Error Response ---
        logging.debug(f"--- Sending Error Response ---")
        logging.debug(f"Error Response (Lang: {language_code}): {server_error_response}")
        logging.debug(f"--- END Request (Error) ---")
        # --- End Logging ---
        return jsonify({"status": "error", "message": str(e), "response": server_error_response}), 500

# Function to initialize the knowledge base - REMOVED
# @app.route("/api/init-knowledge-base", methods=["GET"]) # REMOVED
# def init_knowledge_base(): # REMOVED
    # ... (removed function body) ...

# EEL setup and execution - KEPT
eel.init("web")

def start_flask():
    # Use use_reloader=False to prevent Flask from running the init code twice in debug mode
    app.run(host="localhost", port=8081, debug=True, use_reloader=False)

def main():
    flask_thread = Thread(target=start_flask, daemon=True)
    flask_thread.start()

    try:
        # Consider adding block=False if you need the main Python thread to do other things,
        # but for a simple EEL app, blocking is usually fine.
        eel.start("index.html", mode="chrome", port=8081, size=(1200, 800))
    except (SystemExit, KeyboardInterrupt):
        print("Shutting down the application...")
        # Optionally add cleanup code here if needed
    except Exception as e:
        # Catch potential EEL start errors (e.g., Chrome not found)
        logging.error(f"Failed to start EEL GUI: {e}")
        print(f"Error: Failed to start the application GUI. Please ensure Chrome/Edge is installed. {e}")
    finally:
         # Ensure Flask thread stops if EEL exits abnormally
         # (Though daemon=True should handle this, adding explicit exit might be safer in some scenarios)
         print("Exiting main thread.")
         sys.exit(0) # Ensure the script exits


if __name__ == "__main__":
    main()

# --- END OF FILE app.py ---