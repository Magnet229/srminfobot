import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import logging
from urllib.parse import urljoin, urlparse
import json
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import re


class SRMScraper:
    def __init__(self, base_url="https://www.srmist.edu.in"):
        self.base_url = base_url
        self.visited_urls = set()
        self.data = {
            'general_info': {},
            'programs': [],
            'departments': [],
            'faculty': [],
            'research': [],
            'news_events': [],
            'facilities': [],
            'admissions': [],
            'campus_life': []
        }
        
        # Enhanced logging
        logging.basicConfig(
            filename=f'srm_scraper_debug_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log',
            level=logging.DEBUG,  # Changed to DEBUG level
            format='%(asctime)s - %(levelname)s - %(message)s'
        )

    def setup_selenium(self):
        """Setup Selenium with enhanced options"""
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_argument('--ignore-certificate-errors')
        chrome_options.add_argument('--allow-running-insecure-content')
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(30)  # Set page load timeout
        return driver
    def extract_links(self, soup, base_url):
        """Extract valid links from the page"""
        links = set()
        if not soup:
            return links

        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            # Normalize the URL
            full_url = urljoin(base_url, href)
            
            # Filter links
            parsed_url = urlparse(full_url)
            if (parsed_url.netloc == urlparse(self.base_url).netloc and
                not any(ext in full_url for ext in ['.pdf', '.jpg', '.png', '.doc', '.docx']) and
                full_url not in self.visited_urls):
                links.add(full_url)
        
        return links

    def categorize_content(self, content):
        """Categorize extracted content"""
        url = content.get('url', '')
        
        # Basic categorization logic
        if 'academics' in url or 'programs' in url:
            self.data['programs'].append(content)
        elif 'faculty' in url:
            self.data['faculty'].append(content)
        elif 'research' in url:
            self.data['research'].append(content)
        elif 'departments' in url:
            self.data['departments'].append(content)
        elif 'news' in url or 'events' in url:
            self.data['news_events'].append(content)
        elif 'facilities' in url:
            self.data['facilities'].append(content)
        elif 'admission' in url:
            self.data['admissions'].append(content)
        elif 'campus-life' in url:
            self.data['campus_life'].append(content)
        else:
            # Fallback to general info
            self.data['general_info'][url] = content

    def get_soup(self, url):
        """Enhanced page fetching with detailed debugging"""
        logging.debug(f"Attempting to fetch URL: {url}")
        
        try:
            driver = self.setup_selenium()
            logging.debug("Selenium WebDriver setup complete")
            
            driver.get(url)
            logging.debug("Initial page load complete")
            
            # Wait for content to load
            wait = WebDriverWait(driver, 20)
            try:
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                logging.debug("Body tag found")
                
                # Wait for main content
                content_loaded = False
                for selector in ['main', 'article', '.content', '#content', '.main-content']:
                    try:
                        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                        content_loaded = True
                        logging.debug(f"Content found with selector: {selector}")
                        break
                    except TimeoutException:
                        continue
                
                if not content_loaded:
                    logging.warning(f"No main content selectors found for {url}")
            
            except TimeoutException:
                logging.error(f"Timeout waiting for page load: {url}")
            
            # Scroll to load dynamic content
            driver.execute_script("""
                window.scrollTo(0, 0);
                let totalHeight = document.body.scrollHeight;
                window.scrollTo(0, totalHeight);
                return totalHeight;
            """)
            
            time.sleep(5)  # Increased wait time
            
            page_source = driver.page_source
            logging.debug(f"Page source length: {len(page_source)}")
            
            soup = BeautifulSoup(page_source, "html.parser")
            logging.debug(f"BeautifulSoup parsing complete. Found {len(soup.find_all())} elements")
            
            driver.quit()
            return soup

        except Exception as e:
            logging.error(f"Error fetching {url}: {str(e)}")
            if 'driver' in locals():
                driver.quit()
            return None

    def extract_page_content(self, soup, url):
        """Enhanced content extraction with debugging"""
        logging.debug(f"Extracting content from {url}")
        
        content = {
            'url': url,
            'title': '',
            'content': [],
            'metadata': {}
        }
        
        if not soup:
            logging.error(f"No soup object for {url}")
            return content
            
        # Extract title
        if soup.title:
            content['title'] = soup.title.string.strip()
            logging.debug(f"Found title: {content['title']}")
        
        # Find main content area with multiple selectors
        main_content = None
        for selector in ['main', 'article', '.content', '#content', '.main-content', '.page-content']:
            main_content = soup.find(['main', 'article', 'div'], class_=lambda x: x and selector[1:] in x.lower() if selector.startswith('.') else True)
            if main_content:
                logging.debug(f"Found main content with selector: {selector}")
                break
        
        if main_content:
            # Extract text content
            for element in main_content.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
                text = element.get_text(strip=True)
                if text:
                    content['content'].append({
                        'type': element.name,
                        'text': text
                    })
            
            # Extract lists
            for element in main_content.find_all(['ul', 'ol']):
                items = [item.get_text(strip=True) for item in element.find_all('li')]
                if items:
                    content['content'].append({
                        'type': 'list',
                        'items': items
                    })
            
            logging.debug(f"Extracted {len(content['content'])} content items")
        else:
            logging.warning(f"No main content found for {url}")
        
        return content

    def scrape(self, max_pages=None):
        """Enhanced scraping with better error handling"""
        # Priority URLs
        priority_paths = [
            "/academics",
            "/programs",
            "/faculty",
            "/research",
            "/departments",
            "/news",
            "/facilities",
            "/admission",
            "/campus-life"
        ]
        
        pages_to_visit = {urljoin(self.base_url, path) for path in priority_paths}
        pages_to_visit.add(self.base_url)
        
        pages_scraped = 0
        
        while pages_to_visit and (max_pages is None or pages_scraped < max_pages):
            url = pages_to_visit.pop()
            if url in self.visited_urls:
                continue
                
            logging.info(f"Scraping: {url}")
            
            try:
                soup = self.get_soup(url)
                if not soup:
                    logging.error(f"Failed to get soup for {url}")
                    continue
                
                content = self.extract_page_content(soup, url)
                if content['content']:  # Only categorize if we have content
                    self.categorize_content(content)
                    logging.debug(f"Content categorized for {url}")
                
                # Extract new links
                new_links = self.extract_links(soup, url)
                pages_to_visit.update(new_links)
                
                self.visited_urls.add(url)
                pages_scraped += 1
                
                # Print progress
                logging.info(f"Pages scraped: {pages_scraped}")
                logging.info(f"Categories status:")
                for category, items in self.data.items():
                    if isinstance(items, dict):
                        count = len(items)
                    else:
                        count = len(items)
                    logging.info(f"  {category}: {count} items")
                
                time.sleep(3)  # Increased delay between requests
                
            except Exception as e:
                logging.error(f"Error processing {url}: {str(e)}")
                continue
        
        logging.info("Scraping completed!")
        return self.data
def save_data(self, filename='srm_data_debug.json'):
    """Save scraped data to a JSON file"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=4)
        logging.info(f"Data saved to {filename}")
    except Exception as e:
        logging.error(f"Error saving data: {str(e)}")

def main():
    scraper = SRMScraper()
    scraper.scrape(max_pages=30)  # Start with a smaller number for testing
    scraper.save_data('srm_data_improved1.json')

if __name__ == "__main__":
    main()