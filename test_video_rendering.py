#!/usr/bin/env python3

import requests
import json

# Test the video rendering endpoint
test_manim_code = '''
from manim import *

class DerivativesVideo(Scene):
    def construct(self):
        # Title
        title = Text("Derivatives of Trigonometric Functions", font_size=36, color=BLUE)
        self.play(Write(title))
        self.wait(1)
        self.play(title.animate.to_edge(UP))
        
        # Basic derivative rule
        rule = MathTex(r"\\frac{d}{dx}[\\sin(x)] = \\cos(x)", font_size=48)
        self.play(Write(rule))
        self.wait(2)
        
        # More examples
        examples = VGroup(
            MathTex(r"\\frac{d}{dx}[\\cos(x)] = -\\sin(x)"),
            MathTex(r"\\frac{d}{dx}[\\tan(x)] = \\sec^2(x)")
        ).arrange(DOWN, buff=0.5)
        
        self.play(Transform(rule, examples))
        self.wait(2)
'''

# Send request to backend
url = "http://localhost:5001/api/render-video"
data = {
    "manimCode": test_manim_code,
    "fileName": "test_derivatives_video",
    "topic": "Derivatives of Trig Functions Test"
}

print("Testing video rendering...")
print(f"Sending request to: {url}")

try:
    response = requests.post(url, json=data, timeout=180)
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
