import pandas as pd
import logging
import os
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MappingValidator:
    """
    Validates field mappings in Excel/CSV documents.
    Ensures every source field has a corresponding target field.
    """
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df = None
        
        # Verify file exists
        if not os.path.exists(file_path):
            raise Exception(f"File not found: {file_path}")
        
        self._load_file()
    
    def _load_file(self):
        """Load Excel or CSV file"""
        try:
            # Get file extension
            _, ext = os.path.splitext(self.file_path)
            ext = ext.lower()
            
            if ext == '.csv':
                self.df = pd.read_csv(self.file_path)
            elif ext in ['.xlsx', '.xls']:
                self.df = pd.read_excel(self.file_path, engine=None)
            else:
                raise Exception(f"Unsupported file format: {ext}")
            
            logger.info(f"Loaded file with {len(self.df)} rows and columns: {list(self.df.columns)}")
        except Exception as e:
            raise Exception(f"Failed to load file: {str(e)}")
    
    def get_preview(self) -> dict:
        """
        Return preview of the file for user to configure mapping.
        Shows first 10 rows and all available columns.
        """
        try:
            columns = list(self.df.columns)
            preview_rows = self.df.head(10).fillna('').to_dict('records')
            total_rows = len(self.df)
            
            return {
                'columns': columns,
                'preview': preview_rows,
                'total_rows': total_rows,
                'status': 'success'
            }
        except Exception as e:
            raise Exception(f"Failed to generate preview: {str(e)}")
    
    def validate(self, source_column: str, target_column: str, start_row: int = 1) -> dict:
        """
        Validate that all source fields have corresponding target fields.
        
        Args:
            source_column: Name of the column containing source fields
            target_column: Name of the column containing target fields
            start_row: Which row to start validation from (1-indexed)
        
        Returns:
            Dictionary with validation results
        """
        try:
            # Validate columns exist
            if source_column not in self.df.columns:
                raise Exception(f"Column '{source_column}' not found")
            if target_column not in self.df.columns:
                raise Exception(f"Column '{target_column}' not found")
            
            # Convert start_row from 1-indexed to 0-indexed
            start_idx = start_row - 1
            if start_idx < 0 or start_idx >= len(self.df):
                raise Exception(f"Start row {start_row} is out of range (file has {len(self.df)} rows)")
            
            # Get data from start row onwards
            data = self.df.iloc[start_idx:].copy()
            
            # Find unmapped fields (source fields without target fields)
            unmapped = []
            mapped = []
            
            for idx, row in data.iterrows():
                source = str(row[source_column]).strip() if pd.notna(row[source_column]) else ''
                target = str(row[target_column]).strip() if pd.notna(row[target_column]) else ''
                
                # Skip empty source fields
                if not source or source.lower() == 'nan':
                    continue
                
                if not target or target.lower() == 'nan':
                    unmapped.append({
                        'row': idx + 1,
                        'source': source,
                        'target': target or '[EMPTY]'
                    })
                else:
                    mapped.append({
                        'row': idx + 1,
                        'source': source,
                        'target': target
                    })
            
            result = {
                'status': 'success',
                'total_fields': len(mapped) + len(unmapped),
                'mapped_count': len(mapped),
                'unmapped_count': len(unmapped),
                'validation_status': 'PASS' if len(unmapped) == 0 else 'FAIL',
                'mapped': mapped,
                'unmapped': unmapped
            }
            
            return result
        
        except Exception as e:
            logger.error(f"Validation failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def validate_against_dwl(self, source_column: str, target_column: str, dwl_content: str, start_row: int = 1) -> dict:
        """
        Validate that all source and target fields from Excel are referenced in the DWL file.
        
        Args:
            source_column: Name of the column containing source fields
            target_column: Name of the column containing target fields
            dwl_content: Content of the DWL file
            start_row: Which row to start validation from (1-indexed)
        
        Returns:
            Dictionary with validation results showing which fields are/aren't in DWL
        """
        try:
            # Validate columns exist
            if source_column not in self.df.columns:
                raise Exception(f"Column '{source_column}' not found")
            if target_column not in self.df.columns:
                raise Exception(f"Column '{target_column}' not found")
            
            # Convert start_row from 1-indexed to 0-indexed
            start_idx = start_row - 1
            if start_idx < 0 or start_idx >= len(self.df):
                raise Exception(f"Start row {start_row} is out of range (file has {len(self.df)} rows)")
            
            # Get data from start row onwards
            data = self.df.iloc[start_idx:].copy()
            
            # Collect all source and target fields
            source_fields = []
            target_fields = []
            mapping_pairs = []
            
            for idx, row in data.iterrows():
                source = str(row[source_column]).strip() if pd.notna(row[source_column]) else ''
                target = str(row[target_column]).strip() if pd.notna(row[target_column]) else ''
                
                # Skip empty source fields
                if not source or source.lower() == 'nan':
                    continue
                
                if target and target.lower() != 'nan':
                    source_fields.append({
                        'row': idx + 1,
                        'field': source
                    })
                    target_fields.append({
                        'row': idx + 1,
                        'field': target
                    })
                    mapping_pairs.append({
                        'row': idx + 1,
                        'source': source,
                        'target': target
                    })
            
            # Check which fields are referenced in DWL
            source_found = []
            source_not_found = []
            target_found = []
            target_not_found = []
            
            for item in source_fields:
                if self._search_in_dwl(item['field'], dwl_content):
                    source_found.append(item)
                else:
                    source_not_found.append(item)
            
            for item in target_fields:
                if self._search_in_dwl(item['field'], dwl_content):
                    target_found.append(item)
                else:
                    target_not_found.append(item)
            
            result = {
                'status': 'success',
                'total_mappings': len(mapping_pairs),
                'source_fields': {
                    'total': len(source_fields),
                    'found': len(source_found),
                    'not_found': len(source_not_found),
                    'found_list': source_found,
                    'not_found_list': source_not_found
                },
                'target_fields': {
                    'total': len(target_fields),
                    'found': len(target_found),
                    'not_found': len(target_not_found),
                    'found_list': target_found,
                    'not_found_list': target_not_found
                },
                'mapping_pairs': mapping_pairs,
                'validation_status': 'PASS' if (len(source_not_found) == 0 and len(target_not_found) == 0) else 'FAIL'
            }
            
            return result
        
        except Exception as e:
            logger.error(f"DWL validation failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _search_in_dwl(self, search_term: str, dwl_content: str) -> bool:
        """
        Search for a term in DWL content using multiple patterns.
        
        Args:
            search_term: The term to search for
            dwl_content: The DWL file content
        
        Returns:
            True if found, False otherwise
        """
        if not search_term:
            return False
        
        # Normalize search term
        normalized = search_term.strip()
        
        # Search for field reference patterns in DWL
        patterns = [
            rf'\b{re.escape(normalized)}\b',  # Exact word match
            rf'input\.{re.escape(normalized)}',  # input.FIELD_NAME
            rf'payload\.{re.escape(normalized)}',  # payload.FIELD_NAME
            rf'\${re.escape(normalized)}',  # $FIELD_NAME
            rf'\"{re.escape(normalized)}\"',  # "FIELD_NAME"
            r"'" + re.escape(normalized) + r"'",  # 'FIELD_NAME'
        ]
        
        for pattern in patterns:
            if re.search(pattern, dwl_content, re.IGNORECASE):
                return True
        
        return False
