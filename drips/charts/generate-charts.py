import matplotlib.pyplot as plt
import os
import pandas

repos = [
    # content.elimu.eth
    'crowdsource',
    'webapp',
    
    # engineering.elimu.eth
    'content-provider',
    'keyboard',
    'kukariri',
    'ml-event-simulator',
    'ml-storybook-reading-level',
    'ml-storybook-recommender',
    'model',

    # reading.engineering.elimu.eth
    'VoltAir',
    'familiar-word-reading',
    'herufi',
    'image-picker',
    'silabi',
    'sound-cards',
    'storybooks',
    'visemes',
    'vitabu',
    'walezi-android',

    # writing.engineering.elimu.eth
    'chat',
    'handwriting-letters',
    'handwriting-numbers',

    # math.engineering.elimu.eth
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
    'website',
    'web3-sponsors',
]
for repo in repos:
    print()
    print('repo:', repo)

    csv_path = f'../csvs/splits_{repo}.csv'
    print('csv_path:', csv_path)
    if not os.path.isfile(csv_path):
        print('\033[93m' + 'File not found' + '\033[0m')
        continue

    splits_csv = pandas.read_csv(csv_path)
    print('splits_csv: \n', splits_csv)
    print('splits_csv.columns:', splits_csv.columns)
    print('splits_csv.columns[1:]:', splits_csv.columns[1:])

    # Sort values based on the most recent split event
    last_column = splits_csv.columns[-1]
    print('last_column:', last_column)
    splits_csv = splits_csv.sort_values(by=last_column, ascending=False)
    print('splits_csv: \n', splits_csv)

    splits_set_event_blocks = splits_csv.columns[1:].values
    print('splits_set_event_blocks:', splits_set_event_blocks)

    ethereum_addresses = splits_csv['ethereum_address'].values
    print('ethereum_addresses: \n', ethereum_addresses)

    impact_percentages = splits_csv[splits_set_event_blocks].values
    print('impact_percentages: \n', impact_percentages)

    plt.figure(figsize=(12.8, 4.8))
    plt.stackplot(splits_set_event_blocks, impact_percentages, labels=ethereum_addresses)
    plt.legend(loc='center left', bbox_to_anchor=(1, 0.5))
    plt.tight_layout()
    plt.savefig(f'splits_{repo}.png')
