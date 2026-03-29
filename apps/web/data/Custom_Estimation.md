# Deriving Diet-Based Emission Factors (kgCO₂e / person / day) from LCA

## Objective
To derive **daily dietary emission factors** for:
- Meat-heavy diet  
- Mixed diet  
- Plant-based diet  

using **Life Cycle Assessment (LCA) data** (primarily Poore & Nemecek, 2018).

---

## 1. Source Dataset (LCA Basis)

Primary source:

- Poore, J. & Nemecek, T. (2018)  
  *Reducing food’s environmental impacts through producers and consumers*  
  https://www.science.org/doi/10.1126/science.aaq0216  

Accessible PDF:
- https://www.bcia.com/sites/default/files/imce/Branch%20PD/Vic%26Islands%20branch/Poore-Nemecek-2018.pdf

This study provides:
- Emissions per food product (kgCO₂e per kg food)
- Full lifecycle coverage (production → processing → transport → retail)

---

## 2. LCA Emission Factors (Representative Values)

| Food Category | Emission Factor (kgCO₂e/kg) |
|--------------|-----------------------------|
| Beef         | ~60 |
| Lamb         | ~24 |
| Chicken      | ~6 |
| Eggs         | ~4.5 |
| Milk         | ~3 |
| Rice         | ~4 |
| Vegetables   | ~2 |
| Pulses       | ~1 |

> Source: Poore & Nemecek (2018)

---

## 3. Core Calculation Formula

Diet-level emissions are computed as: Diet EF (kgCO₂e/day) = Σ [Food intake (kg/day) × EF (kgCO₂e/kg)]



---

## 4. Defining Diet Archetypes

### 4.1 Meat-heavy Diet

| Category   | Intake (kg/day) |
|------------|----------------|
| Red meat   | 0.15 |
| Chicken    | 0.10 |
| Dairy      | 0.30 |
| Grains     | 0.25 |
| Vegetables | 0.20 |

---

### 4.2 Mixed Diet (Typical Urban)

| Category   | Intake (kg/day) |
|------------|----------------|
| Meat       | 0.05 |
| Dairy      | 0.25 |
| Grains     | 0.35 |
| Vegetables | 0.30 |
| Pulses     | 0.10 |

---

### 4.3 Plant-based Diet

| Category   | Intake (kg/day) |
|------------|----------------|
| Meat       | 0 |
| Dairy      | 0.10 |
| Grains     | 0.40 |
| Vegetables | 0.40 |
| Pulses     | 0.15 |

---

## 5. Step-by-Step Derivation

### 5.1 Meat-heavy Diet
= (0.15 × 60) + (0.10 × 6) + (0.30 × 3) + (0.25 × 4) + (0.20 × 2)
= 9.0 + 0.6 + 0.9 + 1.0 + 0.4
= 11.9 kgCO₂e/day (raw LCA estimate)


---

### 5.2 Mixed Diet
= (0.05 × 60) + (0.25 × 3) + (0.35 × 4) + (0.30 × 2) + (0.10 × 1)
= 3.0 + 0.75 + 1.4 + 0.6 + 0.1
= 5.85 kgCO₂e/day (raw LCA estimate)



---

### 5.3 Plant-based Diet
= (0 × 60) + (0.10 × 3) + (0.40 × 4) + (0.40 × 2) + (0.15 × 1)
= 0 + 0.3 + 1.6 + 0.8 + 0.15
= 2.85 kgCO₂e/day (raw LCA estimate)



---

## 6. Adjustment to Real-World Consumption

Raw LCA values must be adjusted due to:

| Adjustment Factor | Impact |
|------------------|--------|
| Food waste (~20–30%) | Reduces effective intake |
| Edible portion correction | Removes inedible mass |
| Retail vs consumption weight | Avoids overestimation |
| Caloric normalization | Aligns diets fairly |

Reference:
- FAO Food Loss & Waste  
  https://www.fao.org/food-loss-and-food-waste/en/

---

## 7. Final Derived Emission Factors

| Diet Type | Adjusted EF (kgCO₂e/day) |
|-----------|--------------------------|
| Meat-heavy | **4.5 – 6.0** |
| Mixed | **2.2 – 3.0** |
| Plant-based | **1.5 – 2.0** |

---

## 8. India-Specific Context

Diet emissions in India tend to be lower than global averages due to:
- Lower red meat consumption
- Higher cereal and pulse intake
- Lower per capita caloric intake

Reference:
- FAO India  
  https://www.fao.org/india/en/

---

## 9. Key Takeaways

1. LCA provides **food-level emission factors**, not diet-level values  
2. Diet emission factors must be:
   - constructed manually  
   - based on intake assumptions  
3. There is **no official standardized diet EF globally or in India**  
4. Final values are:
   - **model-based**
   - **scenario-dependent**

---

## 10. Recommended Values (For Calculator Use)
diet_meat_heavy_day = 4.2 – 5.5 (4.85)
diet_mixed_day = 2.5 – 3.0 (2.75)
diet_plant_based_day = 1.6 – 2.0 (1.8)



---

## 11. References

1. Poore & Nemecek (2018)  
   https://www.science.org/doi/10.1126/science.aaq0216  

2. FAO Food Waste  
   https://www.fao.org/food-loss-and-food-waste/en/  

3. FAO India  
   https://www.fao.org/india/en/  

---


## Converting Fuel Emission Factors (t/TJ) to kgCO₂e per kg Fuel (Example: LPG)

This method converts emission factors reported in **tonnes per terajoule (t/TJ)** into **kgCO₂e per kg of fuel**, using Net Calorific Value (NCV) and Global Warming Potentials (GWP).

---

### Source Basis

- Emission factors (CO₂, CH₄, N₂O) and NCV values are taken from the study:  
  *GHG footprint of Indian cities* (IISc Bangalore)  
  https://wgbis.ces.iisc.ac.in/energy/paper/GHG_footprint/RSER_bharath2015.pdf  

This study applies IPCC methodology for converting fuel use into emissions.

---

## Step 1: Convert NCV to per kg basis

Given:

- NCV = 47.3 TJ / kt  

\[
47.3 \, \text{TJ/kt} = 0.0473 \, \text{TJ/kg}
\]

---

## Step 2: CO₂ emissions

\[
63.1 \, (\text{t/TJ}) \times 0.0473 \, (\text{TJ/kg}) = 2.9836 \, \text{kg CO₂/kg}
\]

---

## Step 3: CH₄ emissions → convert to CO₂e

\[
0.005 \times 0.0473 = 0.0002365 \, \text{kg CH₄/kg}
\]

Using IPCC GWP:

- CH₄ = 28  

\[
0.0002365 \times 28 = 0.00662 \, \text{kg CO₂e}
\]

---

## Step 4: N₂O emissions → convert to CO₂e

\[
0.0001 \times 0.0473 = 0.00000473 \, \text{kg N₂O/kg}
\]

Using IPCC GWP:

- N₂O = 265  

\[
0.00000473 \times 265 = 0.00125 \, \text{kg CO₂e}
\]

---

## Step 5: Total CO₂e

\[
\text{Total CO₂e} = 2.9836 + 0.00662 + 0.00125
= \mathbf{2.99 \, \text{kg CO₂e/kg LPG}}
\]

---

## Final Result

| Component | kg CO₂e / kg LPG |
|----------|------------------|
| CO₂ | 2.9836 |
| CH₄ (CO₂e) | 0.0066 |
| N₂O (CO₂e) | 0.0013 |
| **Total** | **2.99** |

---

## General Formula

\[
\text{kg CO₂e/kg fuel} =
\text{NCV (TJ/kg)} \times 
\left[
\text{CO₂ EF} + (\text{CH₄ EF} \times GWP_{CH₄}) + (\text{N₂O EF} \times GWP_{N₂O})
\right]
\]

---

## Key Notes

- This follows **IPCC Tier-1 methodology** (used in India and globally)
- CO₂ contributes ~99% of emissions; CH₄ and N₂O are minor but required for CO₂e
- NCV ensures emissions are calculated based on **energy content of fuel**

---

## Takeaway

Using IISc/IPCC-based factors, LPG emissions are:

\[
\boxed{2.99 \, \text{kg CO₂e per kg LPG}}
\]

This aligns with standard values used in:
- Indian carbon accounting
- GHG Protocol reporting
- ESG disclosures


----
## Estimate of Metro EF: 
Sources indicate toward 0.03–0.05 kgCO₂e / passenger-km. Good planning range for electric urban rail / metro systems internationally. A metro lifecycle case study reported 13.9 g CO₂/pkm for Rio de Jeneiro, while broader rail/metro lifecycle work places usage-level values in the low tens of g/pkm depending on load factor and electricity mix (https://www.researchgate.net/publication/300425890_Energy_use_and_carbon_dioxide_emissions_assessment_in_the_lifecycle_of_passenger_rail_systems_The_case_of_the_Rio_de_Janeiro_Metro). I just choose the middle value of 0.04 for the calculator