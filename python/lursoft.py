import sys
import json

database = {
    '45403000253': {
        'winner_reg_date': '26.11.2004'
    },
    '42403037066': {
        'winner_reg_date': '25.02.2015'
    },
    '40003026637': {
        'winner_reg_date': '20.07.2004'
    },
    '41503041552': {
        'winner_reg_date': '16.04.2007'
    },
    '42103005057': {
        'winner_reg_date': '25.07.1992'
    }
}

user = sys.argv[1]
password = sys.argv[2]
companyRegNums = json.loads(sys.argv[3])  # company registration numbers in LV format e.g. 40002053568
returnData = {}

for regNum in companyRegNums:
    if regNum in database:
        returnData[regNum] = database[str(regNum)]
    else:
        returnData[regNum] = {}




print(json.JSONEncoder().encode(returnData))
