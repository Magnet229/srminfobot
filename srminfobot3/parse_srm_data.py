# parse_srm_data.py
import re
import json
import logging
from datetime import datetime
import os # <--- Import the 'os' module


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
script_dir = os.path.dirname(os.path.abspath(__file__))
# --- Configuration ---
FEE_STRUCTURE_FILE = os.path.join(script_dir, 'fee structure.txt')
GENERAL_INFO_FILE = os.path.join(script_dir, 'SRM Institute of Science and Techno.txt')
SCHOLARSHIP_FILE = os.path.join(script_dir, 'scholarships_combined.txt')
OUTPUT_JSON_FILE = os.path.join(script_dir, 'srm_structured_data.json')

if not os.path.exists(FEE_STRUCTURE_FILE):
    logging.error(f"Fee structure file NOT FOUND at: {FEE_STRUCTURE_FILE}")
if not os.path.exists(GENERAL_INFO_FILE):
    logging.error(f"General info file NOT FOUND at: {GENERAL_INFO_FILE}")
if not os.path.exists(SCHOLARSHIP_FILE):
     logging.error(f"Scholarship file NOT FOUND at: {SCHOLARSHIP_FILE}")
# --- Helper Functions ---
def normalize_program_name(name):
    """Cleans up program names for consistent matching."""
    name = name.strip().replace('-', '').strip()
    # Add more specific replacements if needed (e.g., B.Tech. vs B.Tech)
    name = re.sub(r'\s+', ' ', name) # Replace multiple spaces with one
    return name.lower() # Use lowercase for keys

def parse_fee_line(line):
    """Extracts details from a fee structure line."""
    # Regex might need adjustment based on exact format variations
    # Trying to capture Name, Duration, Fees, Intake
    match = re.search(
        r'(.*?)\s*-\s*Duration\s*:\s*([\d\.]+\s*Years?)\s*\|\s*Annual Fees\s*:\s*₹?\s*([,\d]+)\s*\|\s*Intake\s*:\s*(\d+)',
        line,
        re.IGNORECASE
    )
    # Try alternative format if duration is just a number
    if not match:
         match = re.search(
             r'(.*?)\s*-\s*Duration\s*:\s*(\d+)\s*\|\s*Annual Fees\s*:\s*₹?\s*([,\d]+)\s*\|\s*Intake\s*:\s*(\d+)',
             line,
             re.IGNORECASE
         )
         if match:
              # Add "Years" back if missing
              duration_str = f"{match.group(2)} Years"
         else:
              duration_str = None # Set duration to None if not found
    else:
         duration_str = match.group(2).strip() if match.group(2) else None

    # Handle M.Tech programs with "entire programme" fee
    if not match:
        match = re.search(
            r'(.*?)\s*-\s*Duration\s*:\s*([\d\.]+\s*Years?)\s*\|\s*Annual Fees\s*:\s*₹?\s*([,\d]+)\s*\(for the entire programme\)\s*\|\s*Intake\s*:\s*(\d+)',
            line,
            re.IGNORECASE
        )
        if match:
            duration_str = match.group(2).strip() + " (Fee for entire programme)"

    if match:
        program_name = normalize_program_name(match.group(1))
        fees_str = match.group(3).replace(',', '').strip()
        intake_str = match.group(4).strip()
        return program_name, {
            "duration": duration_str,
            "annual_fees": fees_str,
            "intake": intake_str,
            "original_line": line.strip() # Store original for reference
        }
    else:
        logging.warning(f"Could not parse fee line: {line.strip()}")
        return None, None

def parse_scholarships(filepath):
    """Parses the combined scholarship OCR text."""
    scholarships = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            # This will be highly dependent on the OCR output format.
            # You'll likely need to split by lines and then parse columns
            # based on keywords or consistent spacing/delimiters if any.
            # This is a simplified placeholder - **NEEDS CUSTOMIZATION**
            current_scholarship = {}
            lines = f.readlines()
            # Example: Look for patterns indicating a new scholarship entry
            for line in lines:
                 line = line.strip()
                 if not line: continue
                 # Extremely basic example - needs real logic
                 if line.startswith("I ") or line.startswith("II ") or line.startswith("V "): # Check Sl No
                      if current_scholarship:
                           scholarships.append(current_scholarship)
                      current_scholarship = {'raw_data': [line]}
                 elif current_scholarship:
                      current_scholarship['raw_data'].append(line)
                      # Try to extract key info based on keywords in the line
                      if 'Founder' in line: current_scholarship['Category'] = 'Founder\'s Scholarship'
                      if 'SRM Merit' in line: current_scholarship['Category'] = 'SRM Merit Scholarship'
                      # Add much more sophisticated parsing here...

            if current_scholarship: # Add the last one
                scholarships.append(current_scholarship)

            logging.info(f"Parsed {len(scholarships)} potential scholarship entries from {filepath}")
            # TODO: Refine the parsing logic significantly based on actual OCR text structure.
            # This might involve regex, looking for headers, etc.
            return scholarships
    except FileNotFoundError:
        logging.error(f"Scholarship file not found: {filepath}")
        return []
    except Exception as e:
        logging.error(f"Error parsing scholarship file {filepath}: {e}")
        return []

# --- Main Parsing Logic ---
structured_data = {
    "programs_ug": {}, # Dept -> [Program Names]
    "programs_pg": {}, # Dept -> [Program Names]
    "fees_ug": {},     # Program Name (lower) -> {details}
    "fees_pg": {},     # Program Name (lower) -> {details}
    "scholarships": [],
    "general_info": {}, # Could store Vision, Mission, Hostel info here
    "last_updated": None
}

# 1. Parse Fee Structure File
logging.info(f"Parsing fee structure from: {FEE_STRUCTURE_FILE}")
try:
     if not os.path.exists(GENERAL_INFO_FILE):
         raise FileNotFoundError(f"File not found during open attempt: {GENERAL_INFO_FILE}")
     with open(FEE_STRUCTURE_FILE, 'r', encoding='utf-8') as f:
        current_section = None # e.g., 'ug_programs', 'pg_programs', 'ug_fees', 'pg_fees'
        current_dept = None

        for line in f:
            line = line.strip()
            if not line: continue

            # Detect Section Headers (adjust keywords as needed)
            if "Programs offered for Engineering" in line: continue # Skip main header
            if line.lower().startswith("under graduate"):
                current_section = 'ug_programs'
                logging.info("Processing Section: Under Graduate Programs")
                continue
            if line.lower().startswith("post graduate"):
                current_section = 'pg_programs'
                logging.info("Processing Section: Post Graduate Programs")
                continue
            if line.lower().startswith("fee structure for the programs"): continue # Skip sub-header
            # Need reliable way to detect switch to fee sections
            # Maybe look for lines starting with a number AND containing "Annual Fees" ?
            if re.match(r"^\d+\.", line) and "annual fees" in line.lower() and "under graduate" in current_section:
                 current_section = 'ug_fees'
                 logging.info("Processing Section: Under Graduate Fees")
            elif re.match(r"^\d+\.", line) and "annual fees" in line.lower() and "post graduate" in current_section:
                 current_section = 'pg_fees'
                 logging.info("Processing Section: Post Graduate Fees")

            # Detect Department Headers (Format: Number.Department Name)
            dept_match = re.match(r"^(\d+)\.\s*Department of (.*)", line, re.IGNORECASE)
            if dept_match:
                current_dept = dept_match.group(2).strip()
                if current_section == 'ug_programs': structured_data["programs_ug"][current_dept] = []
                if current_section == 'pg_programs': structured_data["programs_pg"][current_dept] = []
                logging.debug(f" Found Department: {current_dept} in Section: {current_section}")
                continue

            # Process content based on section
            if current_dept and line.startswith("-"):
                program_name = normalize_program_name(line)
                if current_section == 'ug_programs':
                    structured_data["programs_ug"][current_dept].append(program_name)
                elif current_section == 'pg_programs':
                    structured_data["programs_pg"][current_dept].append(program_name)

            elif current_section == 'ug_fees' or current_section == 'pg_fees':
                 prog_key, fee_details = parse_fee_line(line)
                 if prog_key and fee_details:
                     target_dict = structured_data["fees_ug"] if current_section == 'ug_fees' else structured_data["fees_pg"]
                     if prog_key in target_dict:
                          logging.warning(f"Duplicate program fee entry found: {prog_key}")
                     target_dict[prog_key] = fee_details

except FileNotFoundError:
    logging.error(f"Fee structure file not found: {FEE_STRUCTURE_FILE}")
except Exception as e:
    logging.error(f"Error parsing fee structure file: {e}", exc_info=True)

# 2. Parse Scholarship File
logging.info(f"Parsing scholarships from: {SCHOLARSHIP_FILE}")
structured_data["scholarships"] = parse_scholarships(SCHOLARSHIP_FILE)

# 3. Parse General Info File (Optional - Add specific extraction as needed)
logging.info(f"Parsing general info from: {GENERAL_INFO_FILE}")
try:
     if not os.path.exists(GENERAL_INFO_FILE):
         raise FileNotFoundError(f"File not found during open attempt: {GENERAL_INFO_FILE}")
     with open(GENERAL_INFO_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
        # Example: Extract Vision/Mission
        vision_match = re.search(r"Vision\s*\n(.*?)\n\n", content, re.DOTALL | re.IGNORECASE)
        mission_match = re.search(r"Mission\s*\n(.*?)\n\n", content, re.DOTALL | re.IGNORECASE)
        if vision_match: structured_data["general_info"]["vision"] = vision_match.group(1).strip()
        if mission_match: structured_data["general_info"]["mission"] = mission_match.group(1).strip()
        # Add extraction for Hostel info, Rankings etc. using similar regex or keyword logic
        logging.info("Parsed general info (Vision/Mission extracted).")

except FileNotFoundError:
    logging.error(f"General info file not found: {GENERAL_INFO_FILE}")
except Exception as e:
    logging.error(f"Error parsing general info file: {e}")


# 4. Add Timestamp and Save JSON
structured_data["last_updated"] = datetime.now().isoformat()
logging.info(f"Saving parsed data to: {OUTPUT_JSON_FILE}")
try:
    with open(OUTPUT_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(structured_data, f, indent=4, ensure_ascii=False)
    logging.info("Successfully saved structured data.")
except Exception as e:
    logging.error(f"Error saving JSON file: {e}")