import pandas as pd
import logging

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
        self._load_file()
    
    def _load_file(self):
        """Load Excel or CSV file"""
        try:
            if self.file_path.endswith('.csv'):
                self.df = pd.read_csv(self.file_path)
            else:
                self.df = pd.read_excel(self.file_path)
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
            preview_rows = self.df.head(10).to_dict('records')
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
                raise Exception(f"Start row {start_row} is out of range")
            
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
