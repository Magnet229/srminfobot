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

# Initialize components
knowledge_base = SRMKnowledgeBase()
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
    try:
        data = request.json
        query = data.get("query")
        language = data.get("language", "en")

        if not query:
            return jsonify({"error": "No query provided"}), 400

        results = knowledge_base.search_knowledge_base(query)
        response = knowledge_base.format_response(results)

        if not response:
            # Fallback to Gemini API
            logging.info("No relevant information found in knowledge base. Querying Gemini...")
            try:
                gemini_response = model.generate_content(f"""
                    Answer this SRM University query: {query}
                    Context: If unsure, mention to visit official website
                """)
                response = gemini_response.text if gemini_response.text else "No answer could be generated."
            except Exception as e:
                logging.error(f"Gemini API Error: {e}")
                response = "An error occurred while querying the external API."
        return jsonify({
            "status": "success",
            "response": response
        })

    except Exception as e:
        logging.exception("Error in query_knowledge_base")
        return jsonify({"status": "error", "message": str(e)}), 500

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