import os
import pickle
import numpy as np
import pandas as pd

import xgboost as xgb

class LossPredictor:
    def __init__(self, model_path='models/xgboost_income_loss.json', features_path='models/model_features.pkl'):
        self.model_path = model_path
        self.features_path = features_path
        self.model = None
        self.features = None
        self.load_model()

    def load_model(self):
        \"\"\"Load the XGBoost model from disk.\"\"\"
        if os.path.exists(self.model_path) and os.path.exists(self.features_path):
            self.model = xgb.XGBRegressor()
            self.model.load_model(self.model_path)
            
            with open(self.features_path, 'rb') as f:
                self.features = pickle.load(f)
            
            print(f"Model loaded from {self.model_path}")
        else:
            print("Warning: Model or features file not found. Ensure train.py has been run.")

    def predict(self, input_data):
        \"\"\"
        Predict income loss based on input features.
        input_data should be a dictionary containing required features.
        \"\"\"
        if self.model is None:
            raise ValueError("Model is not loaded.")
            
        df = pd.DataFrame([input_data])
        
        # Ensure all required features are present in the exact order as training
        try:
            df = df[self.features]
        except KeyError as e:
            raise KeyError(f"Missing required features for prediction: {e}")
            
        prediction = self.model.predict(df)[0]
        return max(0.0, float(prediction))  # Income loss cannot be negative

