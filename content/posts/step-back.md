---
title: "step back"
date: 2022-03-24T11:03:56-03:00
draft: false
---

Was needed.   

First week is not over yet, but it was not a good one. There were technical issues while trying to brute force subdomains for the xxx.playstation.net with amass. Yes, I chose playstation as one of the targets by the way. The notebook that is being used on the tests almost died while doing it. Then after cancelling the process (but still getting 500+ domains), masscan took a day to finish. When it was done, following my own rules from the previous post, I wanted to send it all to brutespray, but could not find a tool that converted masscan.log results to nmap -oG, which means another step back for writing the script.

    #!/usr/bin/python3
 
    """
    """ Simple script to generate oG results from masscan.log
    """
 
    import os
    import sys
    import argparse
    import subprocess
 
    def get_ips(masscan):
        ips = {}
        for line in masscan:
            spl = line.split()
 
            if(spl[0]=="Timestamp:"):
                if(spl[3] in ips):
                    ips[spl[3]] = ips[spl[3]] + "," + spl[6].split('/')[0] 
                else: 
                    ips[spl[3]] = spl[6].split('/')[0]
 
        return ips
 
    def main(arguments):
        parser = argparse.ArgumentParser(
            description=__doc__,
            formatter_class=argparse.RawDescriptionHelpFormatter)
        parser.add_argument('infile', help="Input file", type=argparse.FileType('r'))
        parser.add_argument('-o', '--outfile', help="Output file", 
                            default=sys.stdout, type=argparse.FileType('w'))
 
        args = parser.parse_args(arguments)
        res = get_ips(args.infile)
    
        for ip in res:
            subprocess.call(['nmap', '-vv', '-reason', '-Pn', '-p ' + res[ip], 
                            '-T4', '-sV', ip, '-oG', ip + ".txt"])
 
    if __name__ == '__main__':
        sys.exit(main(sys.argv[1:]))   

That led me to see that there was no brute forceable services at all. Great. Three days gone, no web application testing at all. I did not even find a domain with a web page on it from xxx.playstation.net. I also felt the need for a viewer of the results. Which will lead me to expend the rest of the week/weekend building a HTML page generator that displays all the nmap results with hostname and ip to tie this whole thing together.  

Tooling is important, it was something I knew before, and I knew I would have to get myself much more familiar with the ones I was not. The first time I ran amass on the target I did not use any api keys.
It was also obvious that I would have to build my own stuff, constantly. I just thought my python would be sharper and in less need of stackoverflow...   

It's a step back, not much progress but progress nonetheless. I should finish my html generator while amassing for more on xxx.playstation.net. When that is done, I go for xxx.sonyentertainmentnetwork.com and while the automated stuff run and the reports are generated I can focus on my.playstation.com, a actual web app, and start the blog posts and testing on web app techniques.  

The only way is forward.

![firstbrick](/images/brick.png#center)
