import random
import math
import json
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum

class ThreatLevel(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class BattlefieldSituation:
    friendly_forces: int
    enemy_forces: int
    terrain: str
    weather: str
    visibility: int  # 1-10 scale
    intel_confidence: int  # 1-10 scale
    mission_type: str
    time_constraint: str
    civilian_presence: bool

@dataclass
class TacticalOption:
    name: str
    description: str
    success_probability: float
    risk_level: ThreatLevel
    confidence_score: float
    expected_casualties: int
    time_required: str
    resource_requirement: str

class BattlefieldAI:
    def __init__(self):
        self.tactical_database = {
            'assault': {
                'base_success': 0.7,
                'terrain_modifiers': {
                    'urban': -0.2, 'forest': -0.1, 'desert': 0.1, 
                    'mountain': -0.3, 'plains': 0.2
                },
                'weather_modifiers': {
                    'clear': 0.1, 'rain': -0.1, 'fog': -0.3, 
                    'storm': -0.4, 'snow': -0.2
                }
            },
            'defend': {
                'base_success': 0.8,
                'terrain_modifiers': {
                    'urban': 0.3, 'forest': 0.2, 'desert': -0.1,
                    'mountain': 0.4, 'plains': -0.2
                },
                'weather_modifiers': {
                    'clear': 0.0, 'rain': 0.1, 'fog': 0.2,
                    'storm': 0.1, 'snow': 0.1
                }
            },
            'retreat': {
                'base_success': 0.9,
                'terrain_modifiers': {
                    'urban': -0.2, 'forest': 0.3, 'desert': 0.2,
                    'mountain': 0.1, 'plains': 0.4
                },
                'weather_modifiers': {
                    'clear': 0.2, 'rain': -0.1, 'fog': 0.3,
                    'storm': -0.3, 'snow': -0.2
                }
            },
            'flank': {
                'base_success': 0.6,
                'terrain_modifiers': {
                    'urban': -0.1, 'forest': 0.4, 'desert': 0.2,
                    'mountain': -0.2, 'plains': 0.3
                },
                'weather_modifiers': {
                    'clear': 0.1, 'rain': -0.2, 'fog': 0.4,
                    'storm': -0.4, 'snow': -0.3
                }
            }
        }
    
    def calculate_fog_of_war_factor(self, situation: BattlefieldSituation) -> float:
        """Calculates uncertainty factor based on intel quality and conditions"""
        base_uncertainty = 0.3
        intel_factor = (10 - situation.intel_confidence) * 0.05
        visibility_factor = (10 - situation.visibility) * 0.03
        return min(base_uncertainty + intel_factor + visibility_factor, 0.8)
    
    def calculate_force_ratio_impact(self, friendly: int, enemy: int) -> float:
        """Game theory-based force ratio analysis"""
        if enemy == 0:
            return 0.5  # Perfect information case
        ratio = friendly / enemy
        # Lanchester's laws approximation
        if ratio >= 2.0:
            return 0.4  # Significant advantage
        elif ratio >= 1.5:
            return 0.2  # Moderate advantage
        elif ratio >= 1.0:
            return 0.0  # Even forces
        elif ratio >= 0.7:
            return -0.2  # Slight disadvantage
        else:
            return -0.4  # Significant disadvantage
    
    def monte_carlo_simulation(self, base_prob: float, uncertainty: float, iterations: int = 1000) -> Tuple[float, float]:
        """Monte Carlo simulation for probability estimation with confidence intervals"""
        results = []
        for _ in range(iterations):
            # Add random uncertainty
            noise = random.gauss(0, uncertainty)
            sim_prob = max(0.1, min(0.9, base_prob + noise))
            results.append(sim_prob)
        
        mean_prob = sum(results) / len(results)
        variance = sum((x - mean_prob) ** 2 for x in results) / len(results)
        confidence = max(0.1, 1.0 - math.sqrt(variance))
        
        return mean_prob, confidence
    
    def assess_civilian_impact(self, situation: BattlefieldSituation, tactic: str) -> float:
        """Assesses civilian casualty risk"""
        if not situation.civilian_presence:
            return 0.0
        
        civilian_risk = {
            'assault': 0.4,
            'defend': 0.1,
            'retreat': 0.05,
            'flank': 0.2
        }
        return civilian_risk.get(tactic, 0.2)
    
    def generate_tactical_options(self, situation: BattlefieldSituation) -> List[TacticalOption]:
        """Main decision engine - generates tactical recommendations"""
        options = []
        fog_factor = self.calculate_fog_of_war_factor(situation)
        force_impact = self.calculate_force_ratio_impact(situation.friendly_forces, situation.enemy_forces)
        
        for tactic_name, tactic_data in self.tactical_database.items():
            # Base probability
            base_prob = tactic_data['base_success']
            
            # Apply terrain modifier
            terrain_mod = tactic_data['terrain_modifiers'].get(situation.terrain.lower(), 0)
            
            # Apply weather modifier
            weather_mod = tactic_data['weather_modifiers'].get(situation.weather.lower(), 0)
            
            # Apply force ratio
            modified_prob = base_prob + terrain_mod + weather_mod + force_impact
            modified_prob = max(0.1, min(0.9, modified_prob))
            
            # Monte Carlo simulation with fog of war
            final_prob, confidence = self.monte_carlo_simulation(modified_prob, fog_factor)
            
            # Estimate casualties
            base_casualties = max(1, int(situation.friendly_forces * (1 - final_prob) * 0.3))
            civilian_risk = self.assess_civilian_impact(situation, tactic_name)
            
            # Risk assessment
            risk_score = (1 - final_prob) + civilian_risk
            if risk_score < 0.3:
                risk_level = ThreatLevel.LOW
            elif risk_score < 0.5:
                risk_level = ThreatLevel.MEDIUM
            elif risk_score < 0.7:
                risk_level = ThreatLevel.HIGH
            else:
                risk_level = ThreatLevel.CRITICAL
            
            # Generate detailed option
            option = TacticalOption(
                name=tactic_name.upper(),
                description=self._generate_description(tactic_name, situation),
                success_probability=round(final_prob, 3),
                risk_level=risk_level,
                confidence_score=round(confidence, 3),
                expected_casualties=base_casualties,
                time_required=self._estimate_time(tactic_name, situation),
                resource_requirement=self._estimate_resources(tactic_name, situation)
            )
            options.append(option)
        
        # Sort by success probability and confidence
        options.sort(key=lambda x: (x.success_probability * x.confidence_score), reverse=True)
        return options
    
    def _generate_description(self, tactic: str, situation: BattlefieldSituation) -> str:
        descriptions = {
            'assault': f"Direct engagement with enemy forces. Terrain: {situation.terrain}, Weather: {situation.weather}",
            'defend': f"Establish defensive positions and wait for enemy approach. Leverage terrain advantage in {situation.terrain}",
            'retreat': f"Strategic withdrawal to better position. Use {situation.weather} weather for cover",
            'flank': f"Maneuver around enemy position using {situation.terrain} terrain for concealment"
        }
        return descriptions.get(tactic, "Tactical maneuver")
    
    def _estimate_time(self, tactic: str, situation: BattlefieldSituation) -> str:
        time_estimates = {
            'assault': "2-4 hours",
            'defend': "4-8 hours", 
            'retreat': "1-2 hours",
            'flank': "3-6 hours"
        }
        return time_estimates.get(tactic, "2-4 hours")
    
    def _estimate_resources(self, tactic: str, situation: BattlefieldSituation) -> str:
        resource_estimates = {
            'assault': "High ammunition, medical support",
            'defend': "Moderate ammunition, engineering support",
            'retreat': "Transportation, rear guard",
            'flank': "Reconnaissance, coordination"
        }
        return resource_estimates.get(tactic, "Standard military resources")

# Web interface wrapper function
def analyze_battlefield_situation(form_data):
    """
    Web wrapper for battlefield analysis
    Takes form data and returns formatted results for web display
    """
    try:
        # Create situation from form data
        situation = BattlefieldSituation(
            friendly_forces=int(form_data['friendly_forces']),
            enemy_forces=int(form_data['enemy_forces']),
            terrain=form_data['terrain'],
            weather=form_data['weather'],
            visibility=int(form_data['visibility']),
            intel_confidence=int(form_data['intel_confidence']),
            mission_type=form_data['mission_type'],
            time_constraint=form_data['time_constraint'],
            civilian_presence=form_data['civilian_presence'] == 'true'
        )
        
        # Initialize AI and analyze
        ai = BattlefieldAI()
        options = ai.generate_tactical_options(situation)
        
        # Format for web response
        web_results = {
            'tactical_options': [
                {
                    'name': option.name,
                    'description': option.description,
                    'success_probability': option.success_probability,
                    'confidence_score': option.confidence_score,
                    'risk_level': option.risk_level.name,
                    'expected_casualties': option.expected_casualties,
                    'time_required': option.time_required,
                    'resource_requirement': option.resource_requirement
                }
                for option in options
            ],
            'fog_of_war_factor': ai.calculate_fog_of_war_factor(situation),
            'force_ratio': situation.friendly_forces / max(situation.enemy_forces, 1),
            'situation': situation
        }
        
        return web_results
        
    except Exception as e:
        raise Exception(f"Battlefield analysis failed: {str(e)}")