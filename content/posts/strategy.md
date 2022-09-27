---
title: "the strategy"
date: 2022-03-14T14:36:50-03:00
draft: true
---

Or the post that should have the strategy but actually became a post about the strategy to build a strategy.  

My methodology for bug hunting, I decided, was going to follow Jason Haddix videos and zseano's guide. The latest interaction of Haddix's does not touch on the application analysis part, only on the recon side and that alone was overwhelming. I initially thought I could pick a tool for every step of the way, quickly wire it together with a python script and generate something to feed a joplin notebook. But there were more steps than I previously thought and way to many tools for every one of them that I was not familiar with.  

Those videos I found, are great to get ideas from, he is trying to touch on as much as possible  and I would not recommend to someone beginning bug hunting, like me. What was clear to me is that the video is about 3 basic steps.  

Find the roots, find subdomains, check the ports. With that in mind, trying to be as simple as I possible can be to start, with the goal of eventually expanding, wiring and automating, let's choose what to do for each.  

#### Roots:  

To find the roots, it seemed like the crunchbase idea is simple enough and could be quickly turned into a joplin note. Crunchbase acquisitions is the first step to go while we use amass and bgp.he.net for ASN enum. I will for now skip the reverse whois, ad/analytics and google-fu parts and but will still be using shodan. So basically:  

>"  
> crunchbase for acquisitions.  
> amass intel -asn [asn-number] that we get from https://bgp.he.net/  
> shodan for the domain.  
>"  

#### Subdomain: 

For subdomain enum I decided to go with gospider, simple go tool, simple output, easy to integrate. That takes care of the first step, linked discovery. For subdomain scraping and brute forcing we are able to use amass again.   

>"  
> ~/go/bin/gospider -s http://domain -v  
> amass enum -d domain (for scraping)  
> amass enum -brute -d domain -w brute.list  
>"   

As an extra, I will try to use Jhaddix all.txt list. 

#### Port analysis:

And last but not least, we will scan all the info we got with masscan and nmap. The issue with masscan is that it only scans IPs and what we got with roots and subdomains we need to convert, using  dnmasscan script. And finally feed it to a tool I just found out about, and shall be used everywhere from now on, brutespray.  

>"  
> sudo ./dnmasscan domains.txt dns.log  
> nmap -vv --reason -Pn -T4 -sV -p 80 --script="banner" -oG nmap.log [ip]  
> python brutespray.py --file ../nmap.log  
>"  

And that concludes the recon process I extracted from Jhaddix. I most likely will also add feroxbuster to as much domains as possible to find stuff:

>"  
>feroxbuster -u url -t 10 -w /seclists/big.txt -x "txt,html,php,asp,aspx,jsp" -v -k -n -q -o file.log  
>"  

And for now that is a good start. I know this looks like a strategy and not really a plan to make one, but this is a very fluid process, things are bound to change on the first target already, steps will be added, steps will be removed. Plus, this is the 'easy' part of hunting, analyzing what you get from recon is where the loot is. For each type of bug, I will write a more in depth look and research. There are bugs that I am familiar with like sqli and bugs I have never exploited outside of tryhackme/htb setups.  

But it is a start.    
Start where you are. Use what you have. Do what you can.  

![lfg](/images/lfg.jpeg#center)
