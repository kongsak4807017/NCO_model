import requests
from bs4 import BeautifulSoup
import re
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_scrape():
    url = "https://cmi.maewanghospital.go.th/web/index.php?r=report%2Fanalysis"
    r = requests.get(url, verify=False)
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # Extract indicator links
    links = set()
    for a in soup.find_all('a', href=True):
        match = re.search(r'id=([A-H]\d+)', a['href'])
        if match:
            links.add(match.group(1))
            
    print(f"Found {len(links)} indicators: {sorted(list(links))[:10]}...")
    
    # Check form inputs on a specific indicator page to see how filters are submitted
    if links:
        target_id = sorted(list(links))[0]
        page_url = f"https://cmi.maewanghospital.go.th/web/index.php?r=report%2Fdrgindexreport&id={target_id}"
        r2 = requests.get(page_url, verify=False)
        soup2 = BeautifulSoup(r2.text, 'html.parser')
        form = soup2.find('form')
        if form:
            print(f"Form Method: {form.get('method', 'GET').upper()}")
            print("Form Inputs:")
            for inp in form.find_all(['input', 'select']):
                print(f"  - {inp.name} name='{inp.get('name')}' id='{inp.get('id')}'")
        else:
            print("No form found on indicator page!")

if __name__ == '__main__':
    test_scrape()
