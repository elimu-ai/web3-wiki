import matplotlib.pyplot as plt
import os
import pandas

def format_ethereum_address(row):
    print('format_ethereum_address')
    if row['ethereum_address'] == '0x0000000000000000000000000000000000000000000000000000000000000000':
        row['ethereum_address'] = '0x0000000000000000000000000000000000000000'
    elif row['ethereum_address'].startswith('0x000000000000000000000000'):
        row['ethereum_address'] = row['ethereum_address'].replace('0x000000000000000000000000', '0x')
    else:
        row['ethereum_address'] = 'dependencies'
    return row

repos = [
    # content.elimu.eth
    'crowdsource',
    'webapp',
    
    # engineering.elimu.eth
    'common-utils',
    'content-provider',
    'keyboard',
    'kukariri',
    'ml-event-simulator',
    'ml-storybook-reading-level',
    'ml-storybook-recommender',
    'model',

    # engineering.elimu.eth - reading
    'VoltAir',
    'filamu',
    'herufi',
    'image-picker',
    'maneno',
    'silabi',
    'sound-cards',
    'storybooks',
    'visemes',
    'vitabu',
    'walezi-android',

    # engineering.elimu.eth - writing
    'chat',
    'handwriting-letters',
    'handwriting-numbers',

    # engineering.elimu.eth - math
    'CameraColorPicker',
    'android_packages_apps_Calculator',
    'missing-number',
    'nambari',
    'nyas-space-quest',
    'nyas-space-quest-qd',
    'shapi',
    'soga',
    'tilt-game',

    # distribution.elimu.eth
    'analytics',
    'appstore',
    'launcher',
    'ml-authentication',
    'start-guide',
    'web3-sponsors',
    'website',
]
for repo in repos:
    print()
    print('repo:', repo)

    csv_path = f'../csvs/splits_{repo}.csv'
    print('csv_path:', csv_path)
    if not os.path.isfile(csv_path):
        print('\033[93m' + 'File not found. Skipping.' + '\033[0m')
        continue

    splits_csv = pandas.read_csv(csv_path)
    print('splits_csv: \n', splits_csv)
    print('splits_csv.columns:', splits_csv.columns)
    print('splits_csv.columns[1:]:', splits_csv.columns[1:])


    splits_set_event_blocks = splits_csv.columns[1:].values
    # print('splits_set_event_blocks:', splits_set_event_blocks)

    splits_csv = splits_csv.apply(format_ethereum_address, axis='columns')
    # print('splits_csv: \n', splits_csv)
    splits_csv = splits_csv.groupby('ethereum_address')[splits_set_event_blocks].sum()
    # print('splits_csv: \n', splits_csv)
    splits_csv = splits_csv.reset_index()
    # print('splits_csv: \n', splits_csv)
    
    # Sort values based on the most recent split event
    last_column = splits_csv.columns[-1]
    # print('last_column:', last_column)
    splits_csv = splits_csv.sort_values(by=last_column, ascending=False)
    print('splits_csv: \n', splits_csv)

    impact_percentages = splits_csv[splits_set_event_blocks].values
    print('impact_percentages: \n', impact_percentages)

    ethereum_addresses = splits_csv['ethereum_address'].values
    print('ethereum_addresses: \n', ethereum_addresses)

    plt.figure(figsize=(12.8, 4.8))
    plt.stackplot(splits_set_event_blocks, impact_percentages, labels=ethereum_addresses)
    plt.legend(loc='center left', bbox_to_anchor=(1, 0.5))
    plt.tight_layout()
    plt.savefig(f'splits_{repo}.png')

print()
print('Chart generation completed')
