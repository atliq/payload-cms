#!/usr/bin/env python3
"""
Directus to Payload API Migration Script
----------------------------------------
Uses Payload REST API to import all data directly to the live production instance.
Bypasses all local OpenNext/Node.js issues completely.

Usage:
  python3 migrate-import.py --api-url https://payload-cms.atliq.workers.dev

Requirements:
  pip install requests python-dotenv
"""
import os
import sys
import csv
import json
import requests
import argparse
from typing import Dict, List, Any, Optional
from pathlib import Path
from urllib.parse import urljoin
from html import unescape
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PayloadMigrator:
    def __init__(self, api_url: str, api_key: Optional[str] = None):
        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
        self.id_maps: Dict[str, Dict[Any, Any]] = {
            'media': {},
            'categories': {},
            'authors': {},
            'posts': {},
            'culture_posts': {},
            'inquiries': {}
        }
        
        if api_key:
            self.session.headers['Authorization'] = f'Bearer {api_key}'
    
    def login(self, email: str, password: str) -> bool:
        """Login to Payload CMS to get authentication cookie"""
        try:
            response = self.session.post(
                urljoin(self.api_url, '/api/users/login'),
                json={'email': email, 'password': password}
            )
            response.raise_for_status()
            logger.info("✅ Logged in successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Login failed: {e}")
            return False
    
    def create_item(self, collection: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a single item in Payload"""
        try:
            response = self.session.post(
                urljoin(self.api_url, f'/api/{collection}'),
                json=data,
                timeout=30
            )
            
            if response.status_code == 409:
                # Conflict - already exists, find it
                return self.find_existing(collection, data)
            
            response.raise_for_status()
            return response.json()['doc']
            
        except Exception as e:
            logger.error(f"❌ Failed to create {collection}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.debug(f"Response: {e.response.text}")
            return None
    
    def find_existing(self, collection: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find existing item by unique field (slug or identifier)"""
        try:
            query = {}
            if 'slug' in data:
                query['where[slug][equals]'] = data['slug']
            elif 'email' in data and 'name' in data:
                query['where[email][equals]'] = data['email']
                query['where[name][equals]'] = data['name']
            else:
                return None
            
            response = self.session.get(
                urljoin(self.api_url, f'/api/{collection}'),
                params=query
            )
            response.raise_for_status()
            docs = response.json()['docs']
            
            if docs:
                logger.info(f"↩️  Found existing {collection}: {data.get('slug', data.get('name'))}")
                return docs[0]
            return None
            
        except Exception as e:
            logger.debug(f"Not found: {e}")
            return None
    
    def import_media(self, csv_path: str) -> Dict[str, int]:
        """Import media records (files are already in R2)"""
        logger.info("\n📷 Importing Media...")
        media_map = {}
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing = self.find_existing('media', {'filename': row['filename']})
                if existing:
                    media_map[row['id']] = existing['id']
                    skipped += 1
                    continue
                
                media_data = {
                    'alt': row.get('alt', row['filename']),
                    'filename': row['filename'],
                    'mimeType': row.get('type', 'image/jpeg'),
                    'filesize': int(row.get('filesize', 0)),
                    'width': int(row.get('width', 0)) if row.get('width') else None,
                    'height': int(row.get('height', 0)) if row.get('height') else None,
                    'url': row.get('url', ''),
                    'thumbnailURL': row.get('thumbnail_url', '')
                }
                
                result = self.create_item('media', media_data)
                if result:
                    media_map[row['id']] = result['id']
                    logger.info(f"✅ Media: {row['filename']} → {result['id']}")
        
        logger.info(f"📷 Media complete: {len(media_map)} imported, {skipped} skipped")
        self.id_maps['media'] = media_map
        return media_map
    
    def import_categories(self, csv_path: str) -> Dict[Any, Any]:
        """Import categories"""
        logger.info("\n📂 Importing Categories...")
        cat_map = {}
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing = self.find_existing('categories', {'slug': row['slug']})
                if existing:
                    cat_map[row['id']] = existing['id']
                    skipped += 1
                    continue
                
                cat_data = {
                    'name': unescape(row['name']),
                    'slug': row['slug']
                }
                
                result = self.create_item('categories', cat_data)
                if result:
                    cat_map[row['id']] = result['id']
                    logger.info(f"✅ Category: {row['name']} → {result['id']}")
        
        logger.info(f"📂 Categories complete: {len(cat_map)} imported, {skipped} skipped")
        self.id_maps['categories'] = cat_map
        return cat_map
    
    def import_authors(self, csv_path: str) -> Dict[Any, Any]:
        """Import authors"""
        logger.info("\n👤 Importing Authors...")
        author_map = {}
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing = self.find_existing('authors', {'slug': row['slug']})
                if existing:
                    author_map[row['id']] = existing['id']
                    skipped += 1
                    continue
                
                author_data = {
                    'name': unescape(row['name']),
                    'slug': row['slug'],
                    'status': row.get('status', 'published'),
                    'linkedinUrl': row.get('linkedin_url', ''),
                    'legacyDescription': row.get('description', ''),
                    'profile': self.id_maps['media'].get(row.get('profile')),
                    'seo': {
                        'title': row.get('seo_title', ''),
                        'metaDescription': row.get('seo_meta_description', ''),
                        'canonicalUrl': row.get('seo_canonical_url', ''),
                        'noIndex': row.get('seo_no_index', 'false').lower() == 'true',
                        'noFollow': row.get('seo_no_follow', 'false').lower() == 'true',
                        'ogImage': self.id_maps['media'].get(row.get('seo_og_image')),
                        'sitemapChangeFrequency': row.get('seo_sitemap_change_frequency'),
                        'sitemapPriority': float(row['seo_sitemap_priority']) if row.get('seo_sitemap_priority') else None
                    }
                }
                
                result = self.create_item('authors', author_data)
                if result:
                    author_map[row['id']] = result['id']
                    logger.info(f"✅ Author: {row['name']} → {result['id']}")
        
        logger.info(f"👤 Authors complete: {len(author_map)} imported, {skipped} skipped")
        self.id_maps['authors'] = author_map
        return author_map
    
    def import_posts(self, csv_path: str, collection_name: str = 'posts') -> Dict[Any, Any]:
        """Import posts or culture posts"""
        logger.info(f"\n📝 Importing {collection_name}...")
        post_map = {}
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing = self.find_existing(collection_name, {'slug': row['slug']})
                if existing:
                    post_map[row['id']] = existing['id']
                    skipped += 1
                    continue
                
                # Map categories
                categories = []
                if 'categories' in row and row['categories']:
                    try:
                        directus_cat_ids = json.loads(row['categories'].replace("'", '"'))
                        categories = [
                            self.id_maps['categories'][cat_id]
                            for cat_id in directus_cat_ids
                            if cat_id in self.id_maps['categories']
                        ]
                    except:
                        pass
                
                # Map tags
                tags = []
                if 'tags' in row and row['tags']:
                    try:
                        tag_list = json.loads(row['tags'].replace("'", '"'))
                        tags = [{'tag': tag} for tag in tag_list]
                    except:
                        pass
                
                post_data = {
                    'title': unescape(row['title']),
                    'slug': row['slug'],
                    'status': row.get('status', 'published'),
                    'publishedAt': row.get('date') or row.get('date_created'),
                    'excerpt': unescape(row.get('excerpt', '')),
                    'legacyContent': row.get('content', ''),
                    'categories': categories,
                    'tags': tags,
                    'seo': {
                        'title': row.get('seo_title', ''),
                        'metaDescription': row.get('seo_meta_description', ''),
                        'canonicalUrl': row.get('seo_canonical_url', ''),
                        'noIndex': row.get('seo_no_index', 'false').lower() == 'true',
                        'noFollow': row.get('seo_no_follow', 'false').lower() == 'true',
                        'ogImage': self.id_maps['media'].get(row.get('seo_og_image')),
                        'sitemapChangeFrequency': row.get('seo_sitemap_change_frequency'),
                        'sitemapPriority': float(row['seo_sitemap_priority']) if row.get('seo_sitemap_priority') else None
                    }
                }
                
                # Add author for regular posts only
                if collection_name == 'posts' and 'author' in row:
                    post_data['author'] = self.id_maps['authors'].get(row['author'])
                
                result = self.create_item(collection_name, post_data)
                if result:
                    post_map[row['id']] = result['id']
                    logger.info(f"✅ {collection_name[:-1].title()}: {row['title'][:50]}... → {result['id']}")
        
        logger.info(f"📝 {collection_name.title()} complete: {len(post_map)} imported, {skipped} skipped")
        self.id_maps[collection_name] = post_map
        return post_map
    
    def import_inquiries(self, csv_path: str) -> None:
        """Import inquiries"""
        logger.info("\n📥 Importing Inquiries...")
        imported = 0
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Check for duplicates
                existing = self.find_existing('inquiries', {
                    'email': row['email'],
                    'name': row['name']
                })
                if existing:
                    skipped += 1
                    continue
                
                inquiry_data = {
                    'name': unescape(row['name']),
                    'email': row['email'],
                    'phone': row.get('phone', ''),
                    'company': row.get('company', ''),
                    'website': row.get('website', ''),
                    'subject': unescape(row.get('subject', '')),
                    'message': unescape(row.get('message', '')),
                    'sourceIp': row.get('source_ip', ''),
                    'status': row.get('status', 'new')
                }
                
                result = self.create_item('inquiries', inquiry_data)
                if result:
                    imported += 1
        
        logger.info(f"📥 Inquiries complete: {imported} imported, {skipped} skipped")
    
    def run_full_migration(self, data_dir: str = '.') -> None:
        """Run complete migration in correct dependency order"""
        data_path = Path(data_dir)
        
        logger.info("🚀 Starting full Payload API migration")
        logger.info(f"🔗 Target API: {self.api_url}")
        
        # Migration order matters!
        self.import_media(data_path / 'Files 20260408.csv')
        self.import_categories(data_path / 'Categories 20260408-1673.csv')
        self.import_authors(data_path / 'Author 20260408-16650.csv')
        self.import_posts(data_path / 'Posts 20260408-16745.csv', 'posts')
        self.import_posts(data_path / 'CulturePosts 20260408-16723.csv', 'culture-posts')
        self.import_inquiries(data_path / 'Inquiries 20260408-16737.csv')
        
        logger.info("\n🎉 MIGRATION COMPLETE!")
        logger.info("\n📊 Summary:")
        for collection, mapping in self.id_maps.items():
            logger.info(f"  {collection}: {len(mapping)} records")


def main():
    parser = argparse.ArgumentParser(description='Migrate Directus data to Payload via REST API')
    parser.add_argument('--api-url', required=True, help='Payload API base URL')
    parser.add_argument('--email', help='Admin email (for login)')
    parser.add_argument('--password', help='Admin password (for login)')
    parser.add_argument('--data-dir', default='.', help='Directory containing CSV files')
    
    args = parser.parse_args()
    
    migrator = PayloadMigrator(args.api_url)
    
    if args.email and args.password:
        if not migrator.login(args.email, args.password):
            sys.exit(1)
    else:
        logger.warning("⚠️  No credentials provided - API key required for protected collections")
    
    migrator.run_full_migration(args.data_dir)


if __name__ == '__main__':
    main()
