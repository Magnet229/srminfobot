# scraper_integration.py
import json
from datetime import datetime


import logging
class SRMKnowledgeBase:
    def __init__(self, data_file='srm_data_improved1.json'):
        self.data_file = data_file
        self.last_update = None
        #self.knowledge_base = self.load_data()
        try:
            self.knowledge_base = self.load_data()
        except Exception as e:
            logging.error(f"Critical error initializing knowledge base: {str(e)}")
            raise
    def load_data(self):
    
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.last_update = datetime.now()
            return data
        except FileNotFoundError:
            # Create empty data structure if file doesn't exist
            default_data = {
                'general_info': {},
                'programs': [],
                'departments': [],
                'faculty': [],
                'research': [],
                'news_events': [],
                'facilities': [],
                'admissions': [],
                'campus_life': [],
                'fees': { # Added fees section
                   'ece': "Please visit [SRM ECE Fees](https://www.srmist.edu.in/program-finder/jsf/epro-posts/meta/department_lists!compare-like:13473;program_level:Undergraduate%2CIntegrated%20Course/)"
                    } 
            }
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(default_data, f)
            return default_data
        except json.JSONDecodeError:
            # Handle corrupt file
            logging.error(f"Error decoding JSON from {self.data_file}")
            return default_data  # Use same default structure

        
    
    def search_knowledge_base(self, query):
        """Search through knowledge base for relevant information"""
        query_terms = query.lower().split()
        results = []
        fee_keywords = ['fees', 'fee', 'fee structure', 'tuition', 'cost', 'expenses', 'scholarships']
        is_fee_query = any(keyword in query.lower() for keyword in fee_keywords)
        # Define category weights for relevance scoring
        category_weights = {
            'general_info': 1.0,
            'programs': 0.9,
            'departments': 0.8,
            'faculty': 0.7,
            'research': 0.6,
            'news_events': 0.5,
            'facilities': 0.8,
            'admissions': 1.0,
            'campus_life': 0.7,
            'fees': 1.0 if is_fee_query else 0.7
        }

        for category, items in self.knowledge_base.items():
            weight = category_weights.get(category, 0.5)
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        content = ' '.join(str(v) for v in item.values()).lower()
                    else:
                        content = str(item).lower()
                
                # Calculate match score
                    score = sum(1 for term in query_terms if term in content)
                    if score > 0:
                        results.append((content, score * weight))
                    
            elif isinstance(items, dict):
                for key, value in items.items():
                    content = str(value).lower()
                    score = sum(1 for term in query_terms if term in content)
                    if score > 0:
                        results.append((value, score * weight))

    # Sort by descending score and return top 3
        results.sort(key=lambda x: x[1], reverse=True)
        return [result[0] for result in results[:3]]

    def _check_relevance(self, query, content):
        """Check if content is relevant to query"""
        query_terms = query.lower().split()
        content = content.lower()
        return any(term in content for term in query_terms)

    def _calculate_relevance(self, query, content):
        """Calculate relevance score between query and content"""
        query_terms = set(query.lower().split())
        content_terms = set(content.lower().split())
        
        # Calculate Jaccard similarity
        intersection = len(query_terms.intersection(content_terms))
        union = len(query_terms.union(content_terms))
        
        if union == 0:
            return 0
        
        return intersection / union

    '''def format_response(self, results):
        """Format search results into a coherent response"""
        if not results:
            return None
            
        response_parts = []
        
        for result in results:
            category = result['category'].replace('_', ' ').title()
            content = result['content']
            
            if isinstance(content, dict):
                # Format dictionary content
                content_str = '. '.join(f"{k}: {v}" for k, v in content.items() if k != 'url')
            else:
                content_str = str(content)
            
            response_parts.append(f"{category}: {content_str}")
        
        return '\n\n'.join(response_parts)'''
    

    def format_response(self, results):
        """Format the response from the knowledge base into points with spacing"""
        if not results:
            return None

        formatted_response = ""
        for i, result in enumerate(results[:10]):
            # Split the result into sentences
            sentences = result.split(". ")   # Split into sentences
            # Add a bullet point and spacing for each sentence
            for j, sentence in enumerate(sentences):
                sentence = sentence.strip()  # Remove leading/trailing spaces
                if sentence:  # Avoid empty sentences
                    formatted_response += f"\n• {sentence}.\n"  # Re-add the period
        return formatted_response

class ScraperManager:
    def __init__(self, scraper, knowledge_base, update_interval_hours=24):
        self.scraper = scraper
        self.knowledge_base = knowledge_base
        self.update_interval = update_interval_hours * 3600  # Convert to seconds
        
    def check_and_update(self):
        """Check if knowledge base needs updating and run scraper if necessary"""
        if (not self.knowledge_base.last_update or 
            (datetime.now() - self.knowledge_base.last_update).total_seconds() > self.update_interval):
            self.scraper.scrape()
            self.scraper.save_data(self.knowledge_base.data_file)
            self.knowledge_base.knowledge_base = self.knowledge_base.load_data()