import eel
import sys
import os
from dotenv import load_dotenv
import google.generativeai as genai
from threading import Thread
from flask import Flask, request, jsonify
from flask_cors import CORS
from main import SRMScraper
from scraper_integration import SRMKnowledgeBase, ScraperManager
import logging
import re
import json

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
              if normalized_query in prog_key:
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
    general_keywords = ['scholarship', 'scholarships', 'financial aid', 'concession']
    is_general_query = any(kw in query_lower for kw in general_keywords)

    found_scholarships = []

    # Search based on keywords in the raw data of each scholarship entry
    # (This needs improvement based on how parse_scholarships structures the data)
    for scholarship in srm_data['scholarships']:
        # Use 'Category' if parsed, otherwise search raw_data
        category = scholarship.get('Category', '').lower()
        raw_data_str = ' '.join(scholarship.get('raw_data', [])).lower()

        if category and category in query_lower: # Match specific category name
             found_scholarships.append(scholarship)
        elif any(kw in query_lower for kw in general_keywords) or \
             any(term in raw_data_str for term in query_lower.split() if len(term) > 3): # Match terms
             found_scholarships.append(scholarship)

    if found_scholarships:
        # Format the response - **NEEDS REFINEMENT BASED ON PARSED STRUCTURE**
        response_parts = ["Here is information on scholarships based on your query:"]
        for schol in found_scholarships[:5]: # Limit results
            # Example formatting - adjust heavily!
            category = schol.get('Category', 'Details')
            details = "\n  ".join(schol.get('raw_data', ['No details available.']))
            response_parts.append(f"\n--- {category} ---\n  {details}")
        return "\n".join(response_parts)

    elif is_general_query:
         return "SRM offers various scholarships like Founder's Scholarship, Merit Scholarship, Socio-Economic Scholarships, etc. Please specify if you are looking for a particular one, or visit the official SRM website's admission section for detailed criteria."

    return None

def search_programs(query):
    """Lists programs, optionally filtered by department or keywords."""
    if not srm_data or ('programs_ug' not in srm_data and 'programs_pg' not in srm_data):
        return None

    query_lower = query.lower()
    response_parts = []
    found = False

    # Combine UG and PG for searching
    all_programs = {**srm_data.get('programs_ug', {}), **srm_data.get('programs_pg', {})}

    # Check if query matches a department name
    matched_dept = None
    for dept in all_programs.keys():
        if dept.lower() in query_lower:
            matched_dept = dept
            break

    if matched_dept:
        response_parts.append(f"Programs offered by the Department of {matched_dept}:")
        ug_progs = srm_data.get('programs_ug', {}).get(matched_dept, [])
        pg_progs = srm_data.get('programs_pg', {}).get(matched_dept, [])

        if ug_progs:
             response_parts.append("\nUndergraduate:")
             for prog in ug_progs: response_parts.append(f" • {prog.title()}")
             found = True
        if pg_progs:
             response_parts.append("\nPostgraduate:")
             for prog in pg_progs: response_parts.append(f" • {prog.title()}")
             found = True
    else:
        # General search for program keywords across all departments
        keywords = [term for term in query_lower.split() if len(term) > 3 and term not in ['list', 'programs', 'courses', 'department']]
        if keywords:
             response_parts.append("Found programs matching your query:")
             count = 0
             for dept, programs in all_programs.items():
                  for prog in programs:
                       if any(kw in prog for kw in keywords):
                            response_parts.append(f" • {prog.title()} (Dept: {dept})")
                            found = True
                            count += 1
                            if count >= 10: break # Limit results
                  if count >= 10: break


    return "\n".join(response_parts) if found else None

# Initialize components
knowledge_base = SRMKnowledgeBase()
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
    # --- END HINDI ---
}


# Keywords to identify predefined topics (add more as needed)
PREDEFINED_TOPIC_KEYWORDS = {
    'hospital': [
        'hospital', 'health', 'medical', 'clinic', 'doctor', 'emergency', 'pharmacy',  # English
        'மருத்துவமனை', 'சுகாதாரம்', 'மருத்துவம்', 'மருந்தகம்', 'மருத்துவர்', 'அவசரம்',  # Tamil
        'హాస్పిటల్', 'ఆసుపత్రి', 'ఆరోగ్యం', 'వైద్య', 'క్లినిక్', 'డాక్టర్', 'ఫార్మసీ', 'అత్యవసరం', 'ఆరోగ్య సేవలు', # Telugu (added ఆరోగ్య సేవలు)
        'ആശുപത്രി', 'ആരോഗ്യം', 'മെഡിക്കൽ', 'ക്ലിനിക്ക്', 'ഡോക്ടർ', 'ഫാർമസി', 'അടിയന്തരാവസ്ഥ', # Malayalam
         'अस्पताल', 'स्वास्थ्य', 'चिकित्सा', 'क्लिनिक', 'डॉक्टर', 'आपातकाल', 'फार्मेसी', 'सेवाएं' 
    ],
    'admissions': [
        'admission', 'admissions', 'apply', 'enroll', 'register', 'application', 'srmjeee', # English
        'சேர்க்கை', 'விண்ணப்பிக்க', 'பதிவு', # Tamil
        'ప్రవేశం', 'నమోదు', 'దరఖాస్తు', # Telugu
        'അഡ്മിഷൻ', 'രജിസ്റ്റർ', 'അപേക്ഷിക്കുക', # Malayalam
         'प्रवेश', 'आवेदन', 'दाखिला', 'पंजीकरण', 'अप्लाई' # Hindi
    ],
    'placements': [
        'placement', 'placements', 'job', 'jobs', 'career', 'recruit', 'company', 'salary', # English
        'வேலைவாய்ப்பு', 'வேலை', 'நிறுவனம்', 'சம்பளம்', # Tamil
        'ప్లేస్‌మెంట్', 'ఉద్యోగం', 'కంపెనీ', 'జీతం', # Telugu
        'പ്ലേസ്മെന്റ്', 'തൊഴിൽ', 'കമ്പനി', 'ശമ്പളം', # Malayalam
        'प्लेसमेंट', 'नौकरी', 'कंपनी', 'वेतन', 'भर्ती', 'करियर' # Hindi
    ],
    'campus': [
        'campus', 'life', 'facilities', 'hostel', 'library', 'sports', 'wifi', # English
        'வளாகம்', 'வாழ்க்கை', 'வசதிகள்', 'விடுதி', 'நூலகம்', 'விளையாட்டு', # Tamil
        'క్యాంపస్', 'జీవితం', 'సౌకర్యాలు', 'హాస్టల్', 'లైబ్రరీ', 'క్రీడలు', # Telugu
        'ക്യാമ്പസ്', 'ജീവിതം', 'സൗകര്യങ്ങൾ', 'ഹോസ്റ്റൽ', 'ലൈബ്രറി', 'സ്പോർട്സ്', # Malayalam
        'कैंपस', 'जीवन', 'सुविधाएं', 'छात्रावास', 'पुस्तकालय', 'खेल', 'वाईफ़ाई', 'इंफ्रास्ट्रक्चर' # Hindi
    ]
    # Add other predefined topics like 'courses', 'fees' etc. with their keywords
}

scraper = SRMScraper()
scraper_manager = ScraperManager(scraper, knowledge_base)

# Check and initialize the knowledge base if the data file is empty or does not exist
if not os.path.exists(knowledge_base.data_file) or os.path.getsize(knowledge_base.data_file) == 0:
    logging.info("Initializing knowledge base with default data")
    try:
        scraper_manager.check_and_update()
    except Exception as e:
        logging.error(f"Error during initial scraping: {e}")

# Function to query the knowledge base
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

        # --- STEP 1: Check for Predefined Topics FIRST ---
        logging.debug("--- Checking Predefined Topics ---")
        matched_topic_key = None
        for topic_key, keywords in PREDEFINED_TOPIC_KEYWORDS.items():
            logging.debug(f"Checking topic: '{topic_key}'")
            keyword_found = False
            for keyword in keywords:
                if keyword in query_lower:
                    logging.debug(f"  MATCH FOUND! Keyword '{keyword}' in query '{query_lower}'")
                    matched_topic_key = topic_key
                    keyword_found = True
                    break # Stop checking keywords for this topic
            if keyword_found:
                logging.debug(f"Topic '{matched_topic_key}' identified.")
                break # Stop checking other topics

        logging.debug(f"Predefined Topic Check Complete. Matched Topic Key: {matched_topic_key}")

        # If a topic was matched, try to return the predefined answer
        if matched_topic_key:
            logging.debug(f"Attempting to retrieve predefined answer for topic '{matched_topic_key}', language '{language_code}'")
            # Check if language exists AND if the topic key exists for that language
            if language_code in srmPredefinedAnswers and matched_topic_key in srmPredefinedAnswers[language_code]:
                predefined_response = srmPredefinedAnswers[language_code][matched_topic_key]
                logging.info(f"SUCCESS: Found predefined answer for '{matched_topic_key}' in '{language_code}'.")

                # Format the predefined response
                formatted_predefined_response = ""
                lines = predefined_response.strip().split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('- '):
                         formatted_predefined_response += f"\n• {line[2:].strip()}\n"
                    elif line:
                         formatted_predefined_response += f"\n{line}\n"

                # --- DETAILED LOGGING: Returning Predefined ---
                logging.debug(f"Formatted Predefined Response:\n{formatted_predefined_response.strip()}")
                logging.debug(f"--- END Request (Predefined) ---")
                # --- End Logging ---
                return jsonify({
                    "status": "success",
                    "response": formatted_predefined_response.strip()
                })
            else:
                logging.warning(f"Predefined topic '{matched_topic_key}' matched, but NO ANSWER found for language '{language_code}'. Falling back.")
        else:
            logging.debug("No predefined topic matched the query.")
        # --- END Predefined Check ---


        # --- STEP 2: Search Internal Knowledge Base (Scraped Data) ---
        logging.debug("--- Searching Knowledge Base ---")
        # ... (rest of the KB search logic - keep it) ...
        kb_results = knowledge_base.search_knowledge_base(query)
        kb_response = knowledge_base.format_response(kb_results)

        if kb_response:
            logging.info(f"Found response in local KB for query: '{query}'.")
            # --- DETAILED LOGGING: Returning KB ---
            logging.debug(f"Formatted KB Response:\n{kb_response}") # Assuming kb_response is already formatted string
            logging.debug(f"--- END Request (KB) ---")
            # --- End Logging ---
            return jsonify({
                "status": "success",
                "response": kb_response
            })
        else:
             logging.debug("No relevant response found in KB.")

        # --- STEP 3: Fallback to Gemini API (If KB also failed) ---
        logging.info(f"No relevant information found in knowledge base for '{query}'. Querying Gemini in language '{language_code}'...")

        # --- Use the same Gemini logic from the previous answer ---
        try:
            language_map = {
                'en': 'English', 'ta': 'Tamil', 'te': 'Telugu', 'ml': 'Malayalam'
            }
            language_name = language_map.get(language_code, 'English')

            strict_prompt = f"""
            You are SRM InfoBot, an assistant for SRM University.
            The user's query is: "{query}"

            **VERY IMPORTANT INSTRUCTION:** Your response MUST be **ONLY** in the **{language_name}** language (language code: {language_code}).
            **DO NOT** use English or any other language unless the requested language is English.
            **DO NOT** include any explanations about why information might be missing or unavailable in {language_name}.
            **DO NOT** apologize for missing information.

            If you have specific, factual information about SRM University relevant to the query "{query}", provide it concisely in **{language_name}**.
            If you do NOT have specific SRM information for the query "{query}", provide a *general* answer about the topic (like campus life, admissions, etc.) based on typical university information, but ensure the answer is still **strictly and ONLY in {language_name}**.

            Generate ONLY the answer text in **{language_name}**. No preambles, no apologies, no language explanations. Format the response clearly, using bullet points (like • point) if appropriate for lists.
            """

            logging.debug(f"Sending prompt to Gemini:\n{strict_prompt}")
            gemini_response = model.generate_content(strict_prompt)

            # Extract text (ensure this part matches your Gemini library version)
            response_text = None
            if hasattr(gemini_response, 'text') and gemini_response.text:
                 response_text = gemini_response.text
            elif hasattr(gemini_response, 'parts') and gemini_response.parts:
                 response_text = "".join(part.text for part in gemini_response.parts)
            elif hasattr(gemini_response, 'candidates') and gemini_response.candidates and gemini_response.candidates[0].content.parts:
                 response_text = gemini_response.candidates[0].content.parts[0].text

            if response_text:
                final_response = response_text.strip()
                 # Basic formatting similar to KB/Predefined for consistency
                formatted_gemini_response = ""
                lines = final_response.strip().split('\n')
                for line in lines:
                    line = line.strip()
                     # Gemini might already use *, -, or • for bullets
                    if line.startswith(('* ', '- ', '• ')):
                        formatted_gemini_response += f"\n• {line[2:].strip()}\n"
                    elif line:
                        formatted_gemini_response += f"\n{line}\n"
                final_response = formatted_gemini_response.strip()

                logging.info(f"Received Gemini response for '{query}' in {language_code}.")
            else:
                error_messages_gemini = {
                    'en': "Sorry, I couldn't generate a specific answer for that query at the moment.",
                    'ta': "மன்னிக்கவும், அந்த வினவலுக்கு என்னால் ஒரு குறிப்பிட்ட பதிலை உருவாக்க முடியவில்லை.",
                    'te': "క్షమించండి, ప్రస్తుతానికి ఆ ప్రశ్నకు నేను నిర్దిష్ట సమాధానాన్ని రూపొందించలేకపోయాను.",
                    'ml': "ക്ഷമിക്കണം, ആ ചോദ്യത്തിന് ഒരു പ്രത്യേക ഉത്തരം നൽകാൻ എനിക്ക് കഴിഞ്ഞില്ല.",
                     'hi': "क्षमा करें, मैं इस समय उस प्रश्न के लिए विशिष्ट उत्तर उत्पन्न नहीं कर सका।" # Added Hindi
                }
                final_response = error_messages_gemini.get(language_code, error_messages_gemini['en'])
                logging.warning(f"Gemini did not generate text content for query '{query}'.")

            return jsonify({
                "status": "success",
                "response": final_response
            })

        except Exception as e:
            logging.error(f"Gemini API Error while processing query '{query}': {e}", exc_info=True)
            error_messages_api = {
                'en': "Sorry, an internal error occurred while trying to get an answer.",
                'ta': "மன்னிக்கவும், பதிலைப் பெற முயற்சிக்கும்போது ஒரு உள் பிழை ஏற்பட்டது.",
                'te': "క్షమించండి, సమాధానం పొందడానికి ప్రయత్నిస్తున్నప్పుడు అంతర్గత లోపం సంభవించింది.",
                'ml': "ക്ഷമിക്കണം, ഉത്തരം ലഭിക്കാൻ ശ്രമിക്കുമ്പോൾ ഒരു ആന്തരിക പിശക് സംഭവിച്ചു.",
                'hi': "क्षमा करें, उत्तर प्राप्त करने का प्रयास करते समय एक आंतरिक त्रुटि हुई।" # Added Hindi
            }
            error_response = error_messages_api.get(language_code, error_messages_api['en'])
            # Ensure response structure is consistent even on error
            return jsonify({"status": "error", "message": "Gemini API Error", "response": error_response}), 500

    except Exception as e:
        logging.exception(f"Unexpected error in query_knowledge_base for query '{query or 'No query provided'}'")
        # Ensure response structure is consistent even on error
        error_messages_server = {
            'en': "Sorry, a server error occurred.",
            'ta': "மன்னிக்கவும், சர்வர் பிழை ஏற்பட்டது.",
            'te': "క్షమించండి, సర్వర్ లోపం సంభవించింది.",
            'ml': "ക്ഷമിക്കണം, ഒരു സെർവർ പിശക് സംഭവിച്ചു.",
            'hi': "क्षमा करें, एक सर्वर त्रुटि हुई।" # Added Hindi
         }
        server_error_response = error_messages_server.get(language_code, error_messages_server['en'])
        return jsonify({"status": "error", "message": str(e), "response": server_error_response}), 500
# Function to initialize the knowledge base
@app.route("/api/init-knowledge-base", methods=["GET"])
def init_knowledge_base():
    try:
        logging.info("Initializing knowledge base...")
        scraper_manager.check_and_update()
        knowledge_base.knowledge_base = knowledge_base.load_data()  # Reload the data after scraping
        logging.info("Knowledge base initialized successfully")
        return jsonify({"status": "success"})

    except Exception as e:
        logging.exception("Error initializing knowledge base")
        return jsonify({"status": "error", "message": str(e)}), 500

# EEL setup and execution
eel.init("web")

def start_flask():
    app.run(host="localhost", port=5000, debug=True)  # Enable debug mode

def main():
    flask_thread = Thread(target=start_flask, daemon=True)
    flask_thread.start()

    try:
        eel.start("index.html", mode="chrome", port=8000, size=(1200, 800))
    except (SystemExit, KeyboardInterrupt):
        print("Shutting down the application...")
        sys.exit(0)

if __name__ == "__main__":
    main()