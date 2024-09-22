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
    'tilt-game'
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

    # splits_set_event_blocks = [18533142, 19533142, 20533142, 21533142, 22533142]
    splits_set_event_blocks = splits_csv.columns[1:].values
    print('splits_set_event_blocks:', splits_set_event_blocks)

    # ethereum_addresses = [
    #     '0x5D388Ec24Cc2C0C77458338696aa63AFB706A7b1',
    #     '0xd46Cc93E3eE6a4fb532D9B48E95be7eD8f8f1DA0',
    #     '0x0000000000000000000000000000000000000000'
    # ]
    ethereum_addresses = splits_csv['ethereum_address'].values
    print('ethereum_addresses: \n', ethereum_addresses)

    # impact_percentages = [
    #     [30, 30, 35, 40, 30],
    #     [45, 45, 35, 35, 50],
    #     [25, 25, 30, 25, 20]
    # ]
    impact_percentages = splits_csv[splits_set_event_blocks].values
    print('impact_percentages: \n', impact_percentages)

    plt.figure(figsize=(12.8, 4.8))
    plt.stackplot(splits_set_event_blocks, impact_percentages, labels=ethereum_addresses)
    plt.legend(loc='center left', bbox_to_anchor=(1, 0.5))
    plt.tight_layout()
    plt.savefig(f'splits_{repo}.png')
